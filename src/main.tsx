/**
 * ============================================================================
 * APPLICATION ENTRY POINT
 * ============================================================================
 *
 * Bootstraps the React application with:
 * - ErrorBoundary for graceful crash handling
 * - AuthProvider for user authentication context
 * - ThemeProvider for dark/light mode
 * - React Router for navigation
 * - TanStack Query for data fetching
 * - Sonner for toast notifications
 * ============================================================================
 */

import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './lib/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/hooks/useTheme"
import { AuthProvider } from "@/context/AuthContext"
import ErrorBoundary from "@/components/ErrorBoundary"
import { ApiError } from "@/lib/apiClient"
import { MouseGlow } from "@/components/layout/MouseGlow"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (failureCount, error) => {
                // Don't retry on 4xx errors (404 = not found, 401 = unauth, 403 = forbidden)
                if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                    return false;
                }
                return failureCount < 2; // Retry server errors up to 2 times
            },
            refetchOnWindowFocus: false,
        },
    },
})

createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <div className="mesh-background" />
            <MouseGlow />
            <RouterProvider router={router} />
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>,
)
