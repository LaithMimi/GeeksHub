
// -- Type Definitions -- //
export interface Course {
    id: string;
    name: string;
    term: string;
    color: string;
    progress?: number;
}

export interface FileData {
    id: string;
    title: string;
    type: "Slides" | "Homeworks" | "Past Papers" | "Notes";
    lecturer: string;
    date: string;
    size: string;
    courseId: string;
    status: "approved" | "pending" | "rejected";
    rejectionReason?: string;
    points?: number;
}

// -- Lookup & Mock Data -- //

export const majors = ["Computer Science", "Mathematics", "Physics"];
export const years = ["Freshman", "Sophomore", "Junior", "Senior"];
export const semesters = ["Fall 2024", "Spring 2025"];
export const lecturers = ["Dr. Smith", "Prof. Johnson", "Dr. Emily Davis"];
export const types = ["Slides", "Homeworks", "Past Papers", "Notes"];

// Course Details Map (Used in CourseShell)
export const courseDetails: Record<string, Course> = {
    cs101: {
        id: "cs101",
        name: "Introduction to Algorithms",
        term: "Fall 2024",
        color: "from-violet-500 to-purple-600",
        progress: 65
    },
    math201: {
        id: "math201",
        name: "Linear Algebra",
        term: "Fall 2024",
        color: "from-blue-500 to-cyan-500",
        progress: 42
    },
    phys101: {
        id: "phys101",
        name: "Classical Mechanics",
        term: "Fall 2024",
        color: "from-emerald-500 to-teal-500",
        progress: 88
    },
};

// Course Hierarchy Map (Used in Courses Page)
export const coursesHierarchy: Record<string, string[]> = {
    "Computer Science": ["CS101 - Intro to Algorithms", "CS102 - Data Structures"],
    "Mathematics": ["MATH201 - Linear Algebra", "MATH202 - Calculus II"],
    "Physics": ["PHYS101 - Mechanics", "PHYS102 - Electromagnetism"]
};


// Files List (Used in Courses Page & Dashboard)
export const allFiles: FileData[] = [
    { id: "123", title: "Introduction to Algorithms.pdf", type: "Notes", lecturer: "Dr. Smith", date: "Oct 24, 2024", size: "2.4 MB", courseId: "cs101", status: "approved", points: 20 },
    { id: "124", title: "Sorting Algorithms.pptx", type: "Slides", lecturer: "Dr. Smith", date: "Oct 26, 2024", size: "12 MB", courseId: "cs101", status: "approved", points: 15 },
    { id: "125", title: "Homework 3 Solutions.pdf", type: "Homeworks", lecturer: "TA. Mike", date: "Nov 01, 2024", size: "1.1 MB", courseId: "cs101", status: "approved", points: 10 },
    { id: "126", title: "Linear Algebra Notes.pdf", type: "Notes", lecturer: "Prof. Johnson", date: "5 hours ago", size: "1.8 MB", courseId: "math201", status: "approved" },
    { id: "127", title: "Physics Lab Report.docx", type: "Homeworks", lecturer: "Dr. Emily Davis", date: "Yesterday", size: "3.5 MB", courseId: "phys101", status: "approved" },
];

// User's specifically tracked requests (including some approved ones that are "mine")
export const userRequests: FileData[] = [
    { id: "req1", title: "Midterm Review.pdf", type: "Notes", lecturer: "Dr. Smith", date: "Pending", size: "1.5 MB", courseId: "cs101", status: "pending" },
    { id: "req2", title: "Old Syllabus.docx", type: "Notes", lecturer: "Dr. Smith", date: "Rejected", size: "0.5 MB", courseId: "cs101", status: "rejected", rejectionReason: "Outdated content" },
    { id: "req3", title: "Calculus Cheat Sheet.pdf", type: "Notes", lecturer: "Prof. Johnson", date: "Oct 20, 2024", size: "2.1 MB", courseId: "math201", status: "approved", points: 25 },
    { id: "req4", title: "Physics Lab Data.xlsx", type: "Homeworks", lecturer: "Dr. Emily Davis", date: "Oct 22, 2024", size: "4.5 MB", courseId: "phys101", status: "approved", points: 15 },
];

export const recentFiles = [
    { name: "Introduction to Algorithms.pdf", course: "CS101", time: "2 hours ago" },
    { name: "Linear Algebra Notes.pdf", course: "MATH201", time: "5 hours ago" },
    { name: "Physics Lab Report.docx", course: "PHYS101", time: "Yesterday" },
];

// Helper to get course list array
export const coursesList = Object.values(courseDetails);
