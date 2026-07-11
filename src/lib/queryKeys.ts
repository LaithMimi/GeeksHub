export const queryKeys = {
    tasks:    { all: () => ["my-tasks"] as const },
    myFiles:  { all: () => ["my-files"] as const, recent: () => ["recent-files"] as const },
    files:    {
        list:            (f?: object) => ["files", f] as const,
        detail:          (id?: string) => ["file", id] as const,
        topContributors: () => ["top-contributors"] as const,
    },
    requests: {
        mine:     () => ["my-requests"] as const,
        all:      () => ["admin-requests"] as const,
        filtered: (f?: object) => ["admin-requests", f] as const,
        stats:    () => ["admin-request-stats"] as const,
        preview:  (id?: string) => ["admin-request-preview-url", id] as const,
    },
    catalog:  {
        majors:    () => ["majors"] as const,
        years:     (majorId?: string) => ["years", majorId] as const,
        semesters: (majorId?: string) => ["semesters", majorId] as const,
        courses:   (f?: object) => ["courses", f] as const,
        course:    (id?: string) => ["course", id] as const,
        lecturers: (f?: object) => ["lecturers", f] as const,
        types:     () => ["material-types"] as const,
    },
    pinnedCourses: { all: () => ["pinned-courses"] as const },
    audit:      {
        all:      () => ["audit-logs"] as const,
        filtered: (f?: object) => ["audit-logs", f] as const,
    },
    reputation: {
        mine: () => ["my-reputation"] as const,
        user: (userId?: string) => ["reputation", userId] as const,
    },
    activity:   { summary: () => ["activity-summary"] as const },
    notifications: {
        list:        () => ["notifications"] as const,
        unreadCount: () => ["notifications-unread-count"] as const,
    },
    directory:  {
        stats:           () => ["directory", "stats"] as const,
        usersRoot:       () => ["directory", "users"] as const, // prefix for invalidating all filtered lists
        users:           (f?: object) => ["directory", "users", f ?? {}] as const,
        majors:          () => ["directory", "majors"] as const,
        lecturers:       () => ["directory", "lecturers"] as const,
        lecturerCourses: (id?: string) => ["directory", "lecturer", id, "courses"] as const,
        courseLecturers: (id?: string) => ["directory", "course", id, "lecturers"] as const,
        courses:         () => ["courses"] as const, // catalog course lists (shared root)
    },
    feedback:   {
        listRoot: () => ["feedback", "list"] as const, // prefix for invalidating all filtered lists
        list:     (f?: object) => ["feedback", "list", f ?? {}] as const,
        stats:    () => ["feedback", "stats"] as const,
    },
} as const;
