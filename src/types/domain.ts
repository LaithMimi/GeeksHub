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

/** Status of user's progress in a course */
export type CourseStatus = "not_started" | "exploring" | "engaged" | "completed";

/** Badge tiers based on reputation points */
export type BadgeTier = "diamond" | "gold" | "silver" | "bronze" | "newcomer";

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
    majorId?: string;
    totalPoints?: number;
    createdAt?: string;
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
    id: string; // "1", "2", "3", "4"
    label: string; // "Freshman", "Sophomore", "Junior", "Senior"
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
    majorId: string;  // camelCase from snake_case major_id
    semesterId?: string; // Optional, not all courses have a separate semesterId
    term?: string; // Display string like "Fall 2024" (may not be in backend)
    color?: string; // Tailwind gradient classes for UI (may not be in backend)
    yearId?: number;   // camelCase from snake_case year_id (e.g. 1, 2, 3, 4)
    semester?: number; // e.g. 1 = Fall, 2 = Spring
}

/**
 * User's activity status in a course.
 */
export interface CourseActivity {
    courseId: string;
    courseName?: string;
    courseCode?: string;
    status: CourseStatus;
    filesCompleted: number;
    totalFiles: number;
    completedAt?: string;
    updatedAt: string;
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
    lecturerId: string;
    courseId: string;
    materialYear: number;
    academicYear: number;
    status: FileStatus;
    points?: number;
    rejectionReason?: string;
    downloadUrl?: string;
}

/**
 * User's request to upload a file.
 * @backend Table: file_requests (FK: user_id, course_id, lecturer_id)
 */
export interface FileRequest {
    id: string;
    userId: string; // FK to users table
    uploaderName?: string; // Denormalized for admin display
    courseId: string;
    courseName?: string; // Denormalized course name from backend
    lecturerId: string; // ID or custom name
    lecturerName: string; // Denormalized for display
    type: MaterialType;
    title: string;
    notes?: string; // Optional notes from submitter
    status: FileStatus;
    createdAt: string; // ISO timestamp
    reviewedAt?: string; // When admin reviewed
    reviewedBy?: string; // Admin user ID (deprecated, use reviewedById)
    reviewedById?: string; // Admin user ID
    rejectionReason?: RejectReason;
    rejectionNote?: string; // Free-text note for rejection
    adminNote?: string; // Admin note (e.g., rejection explanation)
    points?: number; // Legacy: Points awarded if approved
    pointsAwarded?: number; // Actual points awarded (distinct from proposed)
    fileId?: string; // ID of the created file (populated when request is approved)
    materialId?: string; // ID of the approved Material row
    fileUrl?: string; // Temporary GCS path for admin preview
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

/**
 * Viewer session state returned by heartbeat.
 */
export interface ViewerHeartbeatResponse {
    sessionId: string;
    completionScore: number;
    isComplete: boolean;
    pointsAwarded: number;
    courseCompleted: boolean;
    courseId: string | null;
    motivationalQuote: string | null;
    breakReminder: boolean;
    nextIntervalIn: number;
}

/**
 * User's dashboard activity summary.
 */
export interface ActivitySummary {
    totalPoints: number;
    badgeTier: BadgeTier;
    recentTransactions: {
        id: string;
        action: string;
        points: number;
        createdAt: string;
    }[];
    courseActivity: {
        courseId: string;
        courseName: string;
        status: CourseStatus;
        filesCompleted: number;
        totalFiles: number;
    }[];
}

// ============================================================================
// ADMIN / AUDIT TYPES
// ============================================================================

/** Actions that can be performed by admins */
export type AuditAction = "APPROVE" | "REJECT" | "BULK_APPROVE" | "BULK_REJECT" | "WITHDRAW" | "UNDO_APPROVE" | "UNDO_REJECT";

/** Standardized rejection reasons */
export type RejectReason = "DUPLICATE" | "OUTDATED" | "INCORRECT_COURSE" | "BAD_QUALITY" | "OTHER";

/**
 * Audit log entry for tracking admin decisions.
 * @backend Table: audit_logs
 */
export interface AuditLogEntry {
    id: string;
    timestamp: string; // ISO
    actorId: string;
    actorName: string;
    action: AuditAction;
    targetType: "FileRequest";
    targetIds: string[];
    metadata: {
        reason?: RejectReason;
        note?: string;
        pointsAwarded?: number;
        previousStatus?: FileStatus;
        newStatus?: FileStatus;
    };
}

/**
 * Stats for admin dashboard KPIs.
 */
export interface RequestStats {
    pending: number;
    approvedToday: number;
    rejectedToday: number;
}

