import type {
    Course,
    File,
    FileRequest,
    Major,
    Semester,
    Lecturer,
    Contributor,
    PointsTransaction,
    AuditLogEntry
} from "@/types/domain";

/**
Backend DB tables (Postgres/MySQL/etc) that store Majors, Courses, Files, Requests, Points.

Backend API endpoints (REST) that query the DB and return JSON.

Frontend service layer that calls those endpoints with fetch() and returns Promises (same interface as your current services).
TanStack Query can use any Promise-returning function as a query function, including fetch() calls.
​

Below is what each part “becomes” in a real system.

What changes conceptually
Frontend: mock-data.ts → apiClient.ts + services
Instead of exporting arrays like courses and files, you export functions that call the backend:

catalogService.listCourses(filters) → GET /api/courses?...

catalogService.listFiles(filters) → GET /api/files?...

requestService.listMyRequests(userId) → GET /api/me/file-requests

requestService.createFileRequest(payload) → POST /api/file-requests

Your UI (pages/components) should not know whether data came from mocks or DB—only the service implementation changes.

Backend: seed arrays → tables (+ seed scripts)
Your arrays become DB tables, and “filtering with .filter()” becomes SQL queries with indexes.

Example: what the frontend code would look like (real DB via API)
src/lib/apiClient.ts (frontend)
ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  })

  if (!res.ok) {
    // You’d map status codes to typed errors later
    throw new Error(`API error ${res.status}`)
  }

  return res.json() as Promise<T>
}
This stays Promise-based, which is what TanStack Query expects from query functions.
​

src/services/catalogService.ts (frontend)
ts
import { api } from "@/lib/apiClient"
import type { Course, File, Major, Semester, Lecturer } from "@/types/domain"

export const catalogService = {
  listMajors: () => api<Major[]>("/api/majors"),

  listSemesters: () => api<Semester[]>("/api/semesters"),

  listLecturers: (courseId: string, semesterId: string) =>
    api<Lecturer[]>(
      `/api/lecturers?courseId=${courseId}&semesterId=${semesterId}`
    ),

  listCourses: (params: { majorId?: string; semesterId?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>)
    return api<Course[]>(`/api/courses?${qs}`)
  },

  listFiles: (params: {
    courseId?: string
    lecturerId?: string
    type?: string
    status?: string
  }) => {
    const qs = new URLSearchParams(params as Record<string, string>)
    return api<File[]>(`/api/files?${qs}`)
  },
}
TanStack Query usage stays the same
useQuery({ queryKey, queryFn }) where queryFn calls catalogService.listFiles(...).
​

What the backend would look like (high level)
DB tables (mapping your arrays)
majors

semesters

years (or derive from enum)

lecturers

courses (with major_id, semester_id)

files (with course_id, lecturer_id, type, status, size_bytes, storage_key)

file_requests (with user_id, course_id, lecturer_id, status, rejection_reason)

points_transactions (ledger; references request_id so approval is idempotent)

API endpoints (mapping your filters)
You already do filters in UI; move them server-side using query parameters (same idea, but done securely and efficiently):

GET /api/files?courseId=cs101&type=Slides&lecturerId=l1

GET /api/me/file-requests (never return other users’ requests)

What you should do next (to prepare)
Keep your domain types exactly as-is.

Keep your service function names exactly as-is.

When backend is ready, replace the service internals:

from “read mock arrays” → to “call HTTP endpoints”.

That’s the clean migration path.
 */


// -- Latency Simulation --
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const randomDelay = (min = 200, max = 600) => delay(Math.floor(Math.random() * (max - min + 1) + min));

// -- Seed Data --

export const majors: Major[] = [
    { id: "cs", name: "Computer Science", slug: "sem" },
    { id: "math", name: "Mathematics", slug: "math" },
    { id: "phys", name: "Physics", slug: "phys" }
];

export const semesters: Semester[] = [
    { id: "fall2024", name: "Fall 2024" },
    { id: "spring2025", name: "Spring 2025" }
];

export const years = ["Freshman", "Sophomore", "Junior", "Senior"].map((y, i) => ({ id: String(i + 1), label: y }));

export const lecturers: Lecturer[] = [
    { id: "l1", name: "Dr. Smith" },
    { id: "l2", name: "Prof. Johnson" },
    { id: "l3", name: "Dr. Emily Davis" },
    { id: "l4", name: "TA. Mike" }
];

export const courses: Course[] = [
    { id: "cs101", code: "CS101", name: "Introduction to Algorithms", term: "Fall 2024", color: "from-violet-500 to-purple-600", progress: 65, majorId: "cs", semesterId: "fall2024" },
    { id: "cs102", code: "CS102", name: "Data Structures", term: "Spring 2025", color: "from-violet-500 to-purple-600", majorId: "cs", semesterId: "spring2025" },
    { id: "math201", code: "MATH201", name: "Linear Algebra", term: "Fall 2024", color: "from-blue-500 to-cyan-500", progress: 42, majorId: "math", semesterId: "fall2024" },
    { id: "math202", code: "MATH202", name: "Calculus II", term: "Spring 2025", color: "from-blue-500 to-cyan-500", majorId: "math", semesterId: "spring2025" },
    { id: "phys101", code: "PHYS101", name: "Classical Mechanics", term: "Fall 2024", color: "from-emerald-500 to-teal-500", progress: 88, majorId: "phys", semesterId: "fall2024" },
    { id: "phys102", code: "PHYS102", name: "Electromagnetism", term: "Spring 2025", color: "from-emerald-500 to-teal-500", majorId: "phys", semesterId: "spring2025" }
];

// Mutable state for the session
export const files: File[] = [
    { id: "123", title: "Introduction to Algorithms.pdf", type: "Notes", lecturer: "Dr. Smith", date: "Oct 24, 2024", size: "2.4 MB", courseId: "cs101", status: "approved", points: 20 },
    { id: "124", title: "Sorting Algorithms.pptx", type: "Slides", lecturer: "Dr. Smith", date: "Oct 26, 2024", size: "12 MB", courseId: "cs101", status: "approved", points: 15 },
    { id: "125", title: "Homework 3 Solutions.pdf", type: "Homeworks", lecturer: "TA. Mike", date: "Nov 01, 2024", size: "1.1 MB", courseId: "cs101", status: "approved", points: 10 },
    { id: "126", title: "Linear Algebra Notes.pdf", type: "Notes", lecturer: "Prof. Johnson", date: "5 hours ago", size: "1.8 MB", courseId: "math201", status: "approved" },
    { id: "127", title: "Physics Lab Report.docx", type: "Homeworks", lecturer: "Dr. Emily Davis", date: "Yesterday", size: "3.5 MB", courseId: "phys101", status: "approved" },
];

export const fileRequests: FileRequest[] = [
    { id: "req1", userId: "u1", uploaderName: "John Doe", title: "Midterm Review.pdf", type: "Notes", lecturerName: "Dr. Smith", lecturerId: "l1", createdAt: "2024-12-27T10:00:00Z", status: "pending", courseId: "cs101" },
    { id: "req2", userId: "u1", uploaderName: "John Doe", title: "Old Syllabus.docx", type: "Notes", lecturerName: "Dr. Smith", lecturerId: "l1", createdAt: "2024-12-20T09:00:00Z", status: "rejected", rejectionReason: "OUTDATED", rejectionNote: "This syllabus is from 2020", courseId: "cs101" },
    { id: "req3", userId: "u1", uploaderName: "John Doe", title: "Calculus Cheat Sheet.pdf", type: "Notes", lecturerName: "Prof. Johnson", lecturerId: "l2", createdAt: "2024-12-20T14:00:00Z", status: "approved", pointsAwarded: 25, reviewedAt: "2024-12-21T10:00:00Z", reviewedById: "admin1", courseId: "math201" },
    { id: "req4", userId: "u1", uploaderName: "John Doe", title: "Physics Lab Data.xlsx", type: "Homeworks", lecturerName: "Dr. Emily Davis", lecturerId: "l3", createdAt: "2024-12-22T11:00:00Z", status: "approved", pointsAwarded: 15, reviewedAt: "2024-12-23T09:00:00Z", reviewedById: "admin1", courseId: "phys101" },
    // Additional pending requests for admin testing
    { id: "req5", userId: "u2", uploaderName: "Jane Smith", title: "Algorithm Complexity Notes.pdf", type: "Notes", lecturerName: "Dr. Smith", lecturerId: "l1", createdAt: "2024-12-26T14:30:00Z", status: "pending", courseId: "cs101" },
    { id: "req6", userId: "u3", uploaderName: "Bob Wilson", title: "Sorting Visualizations.pptx", type: "Slides", lecturerName: "Dr. Smith", lecturerId: "l1", createdAt: "2024-12-26T16:00:00Z", status: "pending", courseId: "cs101" },
    { id: "req7", userId: "u2", uploaderName: "Jane Smith", title: "Matrix Operations Guide.pdf", type: "Notes", lecturerName: "Prof. Johnson", lecturerId: "l2", createdAt: "2024-12-27T08:00:00Z", status: "pending", courseId: "math201" },
    { id: "req8", userId: "u4", uploaderName: "Alice Brown", title: "Past Exam 2023.pdf", type: "Past Papers", lecturerName: "Dr. Emily Davis", lecturerId: "l3", createdAt: "2024-12-27T09:30:00Z", status: "pending", courseId: "phys101" },
];

export const topContributors: Contributor[] = [
    { id: "c1", name: "Alex Chen", avatar: "AC", points: 1250, badge: "Gold", major: "Computer Science" },
    { id: "c2", name: "Sarah Jones", avatar: "SJ", points: 980, badge: "Silver", major: "Mathematics" },
    { id: "c3", name: "Mike Ross", avatar: "MR", points: 850, badge: "Bronze", major: "Physics" },
    { id: "c4", name: "Emily White", avatar: "EW", points: 720, badge: "Contributor", major: "Computer Science" },
    { id: "c5", name: "David Kim", avatar: "DK", points: 690, badge: "Contributor", major: "Mathematics" },
];

export const pointsTransactions: PointsTransaction[] = [];

// Audit log for admin actions
export const auditLog: AuditLogEntry[] = [];

// Recent Files (In-memory session storage)
export const recentFiles: any[] = [];

// Demo admin user
export const DEMO_ADMIN = {
    id: "admin1",
    name: "Admin User",
    role: "ADMIN" as const
};

