import { http, HttpResponse } from "msw";

export const handlers = [
    http.get("/api/v1/files", () => HttpResponse.json([])),
    http.get("/api/v1/files/recent", () => HttpResponse.json([])),
    http.get("/api/v1/me/tasks", () => HttpResponse.json([])),
    http.get("/api/v1/me/requests", () => HttpResponse.json([])),
    http.get("/api/v1/courses", () => HttpResponse.json([])),
    http.get("/api/v1/majors", () => HttpResponse.json([])),
    http.get("/api/v1/me/activity", () => HttpResponse.json(null)),
    http.get("/api/v1/me/recent-files", () => HttpResponse.json([])),
    http.get("/api/v1/me/activity/summary", () => HttpResponse.json(null)),
];
