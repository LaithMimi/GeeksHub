import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/mocks/server";
import Dashboard from "../Dashboard";

vi.mock("@/features/auth/context/AuthContext", async () => {
    const actual = await vi.importActual<typeof import("@/features/auth/context/AuthContext")>("@/features/auth/context/AuthContext");
    return {
        ...actual,
        useAuth: () => ({
            user: { id: "1", displayName: "Test User", role: "student" },
            isLoading: false,
            error: null,
            signIn: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
        }),
    };
});

function renderDashboard() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Dashboard />
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe("Dashboard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders without crashing", async () => {
        renderDashboard();
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    });

    it("shows skeleton placeholders while loading", async () => {
        // Delay the response so skeletons stay on screen
        server.use(
            http.get("/api/v1/me/recent-files", async () => {
                await delay(100);
                return HttpResponse.json([]);
            })
        );
        const { container } = renderDashboard();
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
        
        // Wait for it to finish so the test doesn't leak
        await waitFor(() => {
            expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
        });
    });

    it("shows error state when recentFiles returns 500", async () => {
        server.use(
            http.get("/api/v1/me/recent-files", () => HttpResponse.json({ detail: "Error" }, { status: 500 }))
        );
        renderDashboard();
        expect(await screen.findByText("Couldn't load dashboard")).toBeInTheDocument();
        expect(screen.getByText("Something went wrong. Let's try again.")).toBeInTheDocument();
    });

    it("shows 'No courses yet' empty state when recentFiles is []", async () => {
        server.use(
            http.get("/api/v1/me/recent-files", () => HttpResponse.json([]))
        );
        renderDashboard();
        expect(await screen.findByText("No courses yet")).toBeInTheDocument();
        expect(screen.getByText("Browse courses to get started")).toBeInTheDocument();
    });

    it("shows task list when tasks are present", async () => {
        server.use(
            http.get("*/api/v1/me/tasks", () => {
                return HttpResponse.json([
                {
                    id: "task-1",
                    title: "Finish math assignment",
                    date: "2026-05-25",
                    startHour: 10,
                    duration: 2,
                    priority: "high",
                    completed: false,
                    createdAt: "2026-05-25T00:00:00Z"
                }
            ])})
        );

        renderDashboard();
        
        await waitFor(() => {
            const elements = screen.getAllByText(/Finish math assignment/i);
            expect(elements.length).toBeGreaterThan(0);
        });
    });
});
