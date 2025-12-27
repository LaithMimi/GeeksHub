/**
 * ============================================================================
 * DOMAIN TYPES
 * ============================================================================
 * 
 * TypeScript interfaces representing the core data models of the application.
 * These types are shared between the UI components and service layer.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * When the backend is implemented:
 * 
 * 1. KEEP TYPES IN SYNC with backend schemas:
 *    - Generate types from OpenAPI/Swagger spec if available
 *    - Or maintain manually and ensure backend returns matching shapes
 * 
 * 2. POTENTIAL ADDITIONS for production:
 *    - createdAt, updatedAt timestamps on all entities
 *    - User.avatarUrl instead of avatarInitials
 *    - File.uploadedBy (user ID of uploader)
 *    - File.sizeBytes (number) instead of size (string)
 *    - Pagination types: { data: T[], total: number, page: number, limit: number }
 * 
 * 3. BACKEND TABLE MAPPING:
 *    - User → users table
 *    - Major → majors table
 *    - AcademicYear → academic_years table (or enum)
 *    - Semester → semesters table
 *    - Course → courses table (FK: major_id, semester_id)
 *    - Lecturer → lecturers table
 *    - File → files table (FK: course_id, lecturer_id, uploader_id)
 *    - FileRequest → file_requests table (FK: user_id, course_id, lecturer_id)
 *    - Contributor → computed view (JOIN users + points_transactions)
 *    - PointsTransaction → points_transactions table (FK: user_id, request_id)
 * 
 * 4. CONSIDER USING ZOD for runtime validation:
 *    ```ts
 *    import { z } from 'zod';
 *    
 *    export const FileSchema = z.object({
 *        id: z.string(),
 *        title: z.string(),
 *        type: z.enum(['Slides', 'Homeworks', 'Past Papers', 'Notes']),
 *        // ...
 *    });
 *    
 *    export type File = z.infer<typeof FileSchema>;
 *    ```
 * ============================================================================
 */

// ============================================================================
// ENUMS / UNION TYPES
// ============================================================================

/** User roles for authorization */
export type Role = "STUDENT" | "ADMIN" | "MODERATOR";

/** Status of a file or file request */
export type FileStatus = "pending" | "approved" | "rejected";

/** Badge tiers based on reputation points */
export type BadgeTier = "Gold" | "Silver" | "Bronze" | "Contributor";

/** Types of course materials */
export type MaterialType = "Slides" | "Homeworks" | "Past Papers" | "Notes";

// ============================================================================
// USER & AUTH
// ============================================================================

/**
 * User entity.
 * @backend Table: users
 */
export interface User {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    avatarInitials: string; // e.g., "JD" - consider avatarUrl for production
}

// ============================================================================
// CATALOG ENTITIES
// ============================================================================

/**
 * Academic major/department.
 * @backend Table: majors
 */
export interface Major {
    id: string; // e.g. "cs"
    name: string; // "Computer Science"
    slug: string;
}

/**
 * Academic year level.
 * @backend Table: academic_years (or static enum)
 */
export interface AcademicYear {
    id: string; // "1", "2"
    label: string; // "Freshman"
}

/**
 * Academic semester.
 * @backend Table: semesters
 */
export interface Semester {
    id: string; // "fall2024"
    name: string; // "Fall 2024"
}

/**
 * Course entity.
 * @backend Table: courses (FK: major_id, semester_id)
 */
export interface Course {
    id: string;
    code: string; // "CS101"
    name: string;
    majorId: string;
    semesterId: string; // For filtering
    term: string; // Display string like "Fall 2024"
    color: string; // Tailwind gradient classes for UI
    progress?: number; // Optional: user's progress in course
}

/**
 * Lecturer/instructor.
 * @backend Table: lecturers
 */
export interface Lecturer {
    id: string;
    name: string;
}

// ============================================================================
// FILE ENTITIES
// ============================================================================

/**
 * Uploaded file/document.
 * @backend Table: files (FK: course_id, lecturer_id)
 */
export interface File {
    id: string;
    title: string;
    type: MaterialType;
    lecturer: string; // Name for display (denormalized)
    lecturerId?: string; // FK to lecturers table
    courseId: string;
    date: string; // ISO or display string - consider createdAt timestamp
    size: string; // Consider sizeBytes: number for production
    status: FileStatus;
    points?: number; // Points awarded for this file
    rejectionReason?: string;
    downloadUrl?: string; // Pre-signed S3/GCS URL for download
}

/**
 * User's request to upload a file.
 * @backend Table: file_requests (FK: user_id, course_id, lecturer_id)
 */
export interface FileRequest {
    id: string;
    userId: string; // FK to users table
    courseId: string;
    lecturerId: string; // ID or custom name
    lecturerName: string; // Denormalized for display
    type: MaterialType;
    title: string;
    notes?: string; // Optional notes from submitter
    status: FileStatus;
    createdAt: string; // ISO timestamp
    reviewedAt?: string; // When admin reviewed
    reviewedBy?: string; // Admin user ID
    rejectionReason?: string;
    points?: number; // Points awarded if approved
}

// ============================================================================
// REPUTATION / GAMIFICATION
// ============================================================================

/**
 * Top contributor for leaderboard.
 * @backend Computed from JOIN users + SUM(points_transactions)
 */
export interface Contributor {
    id: string;
    name: string;
    avatar: string; // Initials or URL
    points: number;
    badge: BadgeTier;
    major: string;
}

/**
 * User's reputation summary.
 * @backend Computed from users + points_transactions
 */
export interface ReputationSummary {
    userId: string;
    totalPoints: number;
    badge: BadgeTier;
    transactions: PointsTransaction[]; // Recent transactions
}

/**
 * Points transaction entry.
 * @backend Table: points_transactions (FK: user_id, request_id)
 * @note requestId is used for idempotency - prevent double awarding
 */
export interface PointsTransaction {
    id: string;
    userId: string;
    amount: number;
    reason: string; // e.g., "File Approved"
    date: string; // ISO timestamp
    requestId?: string; // Link to file request that earned this
}
