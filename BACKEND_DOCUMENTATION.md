# GeeksHub — Backend Documentation & Tasks Master Document

> **Version:** 2.0.0  
> **Last Updated:** March 10, 2026  
> **Frontend Stack:** React + TypeScript + TanStack Query  
> **Backend Stack:** FastAPI + SQLModel + PostgreSQL (Neon DB)

This document serves as the single source of truth for the GeeksHub backend. It combines the original Product Requirements Document (PRD), recent architectural updates, database schemas, and a prioritized list of API tasks.

---

## Table of Contents
1. [Executive Summary (PRD)](#1-executive-summary-prd)
2. [Recent Architectural Updates](#2-recent-architectural-updates-frontend-handoff)
3. [Tech Stack & API Conventions](#3-tech-stack--api-conventions)
4. [Database Schema & Core Entities](#4-database-schema--core-entities)
5. [API Implementation Status & Tasks](#5-api-implementation-status--tasks)
6. [Dashboard Metric Tasks](#6-dashboard-metric-tasks)
7. [Workflows & Core Logic](#7-workflows--core-logic)

---

## 1. Executive Summary (PRD)

### Problem Statement
University students struggle to find high-quality, organized academic resources (slides, past papers, notes) for their specific courses and lecturers. Existing solutions are disorganized or lack curation. We need a centralized, trusted repository where contributions are incentivized and vetted.

### Goals
- Build a centralized, searchable academic library structured by the university's academic hierarchy.
- Implement a community-driven contribution system with a reputation engine.
- Ensure high content quality through a robust admin moderation workflow.
- Provide a responsive, public-read API for the frontend.

### Roles & Permissions
1. **Student (Public)**: Can browse and download files.
2. **Student (Authenticated)**: Can submit file requests and view their reputation.
3. **Admin**: Can view pending requests, approve/reject files, and manage metadata (courses, lecturers).

---

## 2. Recent Architectural Updates (Frontend Handoff)

The frontend has been heavily refactored from isolated mock scripts to a centralized `apiClient`. The backend must adhere to the following contracts:

### A. Authentication & HTTP-Only Cookies (Implemented ✅)
Tokens are no longer sent via the `Authorization` header from `localStorage`. Instead, the frontend relies on HTTP-Only cookies.
- Responses to `POST /api/v1/signin` issue an `auth_token` cookie.
- The cookie is automatically handled by the browser on protected routes (using `credentials: "include"`).
- `POST /api/v1/signout` deletes this cookie.

### B. No Hardcoded Identities
Previously, the frontend mocked actions using `userId = "u1"` or `adminId = "admin1"`.
- The backend **must not trust** any user ID sent in the request body.
- Extract the user's ID, Name, and Role securely from the validated JWT token on the server side.
- This applies specifically to **File Requests** (knowing who uploaded it) and **Admin Actions** (Audit logs knowing which admin approved it).

### C. Major Requirement
During Signup, users must provide a `major_id`. This is inserted into the `users` table via Neon DB to power the custom Course Library UI. `GET /api/v1/majors` handles retrieving available options and is a public endpoint used before authentication.

---

## 3. Tech Stack & API Conventions

| Item | Convention |
|------|-----------|
| **Base URL** | `/api/v1` |
| **Auth** | `HttpOnly` JWT cookie (`auth_token`) |
| **User context** | All protected endpoints extract user from the JWT automatically. |
| **Responses** | JSON, with appropriate HTTP status codes |
| **Errors** | HTTPException JSON structure |
| **Pagination** | `?page=1&limit=20` where applicable, response: `{ data: T[], total: number }` |
| **Timestamps** | ISO 8601 strings (e.g. `2026-03-10T10:00:00Z`) |

---

## 4. Database Schema & Core Entities

The database uses PostgreSQL (Neon). Refer to `server/models.py` for exact SQLModel implementions. The core logical structure is:

* `Major` -(1:N)-> `Course`
* `Course` + `Lecturer` + `Semester` -> `CourseOffering`
* `CourseOffering` -(1:N)-> `File` (via approved requests)
* `User` -(1:N)-> `FileRequest`
* `User` -(1:1)-> `UserReputation`

### File Storage Abstraction
We decouple metadata from physical storage (using Google Cloud Storage - GCS).
- **Naming Convention**: UUID-based names to prevent collision.
- **Pre-signed URLs**: The API does not stream files. It generates a short-lived (15min) pre-signed URL for the frontend to download directly from storage directly (`/api/v1/files/:id/download`).

---

## 5. API Implementation Status & Tasks

The frontend interacts entirely with `/api/v1/*`. The endpoints are marked with their current completion status in `server/main.py`.

### A. Authentication & Users (Completeness: ✅✅✅)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/signup` | Register via Auth0 + local Neon DB | ✅ |
| `POST` | `/api/v1/signin` | Login, sets HTTP-only `auth_token` cookie | ✅ |
| `POST` | `/api/v1/signout`| Clears `auth_token` cookie | ✅ |
| `POST` | `/api/v1/forgot-password` | Send Auth0 password reset email | ✅ |
| `GET`  | `/api/v1/me` | Get current user profile | ✅ |

### B. Catalog (Completeness: 🟡)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/majors` | List all majors | ✅ |
| `GET` | `/api/v1/courses` | List courses (supports search and UUID filters) | ✅ |
| `GET` | `/api/v1/years` | List all academic years | 🔴 |
| `GET` | `/api/v1/semesters` | List all semesters | 🔴 |
| `GET` | `/api/v1/lecturers?course_id=` | List lecturers for a course | 🔴 |

### C. File Requests & Moderation (Completeness: 🟡)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/courses/{id}/upload`| Upload to GCS pending & submit request | ✅ |
| `PATCH`| `/api/v1/admin/requests/{id}/approve`| Approve/reject (moves/deletes GCS blob) | ✅ |
| `GET` | `/api/v1/me/requests` | List current user's requests | 🔴 |
| `DELETE`| `/api/v1/me/requests/:id` | Withdraw a pending request | 🔴 |
| `GET` | `/api/v1/admin/requests` | *(Admin)* List all requests | 🔴 |
| `POST` | `/api/v1/admin/requests/bulk`| *(Admin)* Bulk approve/reject | 🔴 |

### D. File Delivery & Browsing (Completeness: 🟡)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/files/{id}/download`| Generate signed GCS URL | ✅ |
| `GET` | `/api/v1/files?course_id=` | List files with filters | 🔴 |
| `GET` | `/api/v1/files/:id` | Get single file metadata | 🔴 |

### E. User Activity & Gamification (Completeness: 🔴)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/reputation` | Calc total points & badge tier | 🔴 |
| `GET` | `/api/v1/contributors/top` | Leaderboard calculations | 🔴 |
| `GET` | `/api/v1/me/recent-files` | Get user's recently viewed/opened files | 🔴 |
| `POST` | `/api/v1/me/recent-files/:id`| Upsert viewed file timestamp | 🔴 |
| `GET` | `/api/v1/me/settings` | Get user preferences | 🔴 |
| `PATCH`| `/api/v1/me/settings` | Update preferences | 🔴 |

### F. Tasks & Schedule (Completeness: 🔴)
*(Currently reliant on LocalStorage in the frontend hook)*
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/me/tasks` | List learning tasks | 🔴 |
| `POST` | `/api/v1/me/tasks` | Create task | 🔴 |
| `PATCH`| `/api/v1/me/tasks/:id` | Update (toggle completion) | 🔴 |
| `DELETE`| `/api/v1/me/tasks/:id` | Delete task | 🔴 |

### G. AI Assistant & Utilities (Completeness: 🔴)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `POST` | `/api/v1/assistant/chat` | Send message, get AI SSE response | 🔴 |
| `GET` | `/api/v1/me/notes?fileId=` | Retrieve notes | 🔴 |
| `POST` | `/api/v1/me/notes` | Upsert notes | 🔴 |
| `GET` | `/api/v1/admin/audit-logs` | Action history for Admins | 🔴 |

---

## 6. Dashboard Metric Tasks
The frontend Dashboard relies on real data for its KPIs. The following endpoints should be prioritized:

| Priority | Hero Metric | Endpoint Needed | Expected Response |
|---|---|---|---|
| **1** | XP Earned | `GET /api/v1/me/reputation` | `{ totalPoints: number, level: number }` |
| **2** | Courses Active | `GET /api/v1/me/courses/active` | `[ { courseId: string, ... } ]` |
| **3** | Tasks Done | `GET /api/v1/me/tasks` | `[ { id: string, completed: boolean } ]` |
| **4** | Study Hours | `GET /api/v1/me/study-hours` | `{ hours: number }` |

---

## 7. Workflows & Core Logic

### Approval Idempotency
When approving a request (`PATCH /api/v1/admin/requests/{id}/approve`):
1. **Move File**: Move GCS blob from `pending/` to standard active directory.
2. **Metadata**: Change status to `APPROVED` / insert into public `Files` view.
3. **Reputation**: Award points to the uploader. This must be idempotent (ensure user is not double-awarded points if the endpoint is called consecutively).

### Single Responsibility Rule
Admin identities, Uploader boundaries, and Request authorizations must always be calculated against the JWT server-side, never trusted off the request body.
