import { http, HttpResponse } from "msw";

export const handlers = [
    http.get("/api/v1/files", () => HttpResponse.json([])),
    http.get("/api/v1/me/tasks", () => HttpResponse.json([])),
];
