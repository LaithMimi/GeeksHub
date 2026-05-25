export const queryKeys = {
    tasks:    { all: () => ["my-tasks"] as const },
    myFiles:  { all: () => ["my-files"] as const, recent: () => ["recent-files"] as const },
    requests: {
        mine:     () => ["my-requests"] as const,
        all:      () => ["admin-requests"] as const,
        filtered: (f?: object) => ["admin-requests", f] as const,
        stats:    () => ["admin-request-stats"] as const,
        preview:  (id?: string) => ["admin-request-preview-url", id] as const,
    },
    catalog:  {
        majors:    () => ["majors"] as const,
        courses:   (f?: object) => ["courses", f] as const,
        lecturers: (f?: object) => ["lecturers", f] as const,
        types:     () => ["material-types"] as const,
    },
    audit:      { all: () => ["audit-logs"] as const },
    reputation: { mine: () => ["my-reputation"] as const },
    activity:   { summary: () => ["activity-summary"] as const },
} as const;
