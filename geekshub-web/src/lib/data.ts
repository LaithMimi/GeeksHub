
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
    { id: "123", title: "Introduction to Algorithms.pdf", type: "Notes", lecturer: "Dr. Smith", date: "Oct 24, 2024", size: "2.4 MB", courseId: "cs101" },
    { id: "124", title: "Sorting Algorithms.pptx", type: "Slides", lecturer: "Dr. Smith", date: "Oct 26, 2024", size: "12 MB", courseId: "cs101" },
    { id: "125", title: "Homework 3 Solutions.pdf", type: "Homeworks", lecturer: "TA. Mike", date: "Nov 01, 2024", size: "1.1 MB", courseId: "cs101" },
    { id: "126", title: "Linear Algebra Notes.pdf", type: "Notes", lecturer: "Prof. Johnson", date: "5 hours ago", size: "1.8 MB", courseId: "math201" },
    { id: "127", title: "Physics Lab Report.docx", type: "Homeworks", lecturer: "Dr. Emily Davis", date: "Yesterday", size: "3.5 MB", courseId: "phys101" },
];

export const recentFiles = [
    { name: "Introduction to Algorithms.pdf", course: "CS101", time: "2 hours ago" },
    { name: "Linear Algebra Notes.pdf", course: "MATH201", time: "5 hours ago" },
    { name: "Physics Lab Report.docx", course: "PHYS101", time: "Yesterday" },
];

// Helper to get course list array
export const coursesList = Object.values(courseDetails);
