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

import './instrument' // Sentry — MUST be imported before any other app module
import { createRoot } from 'react-dom/client'
import { reactErrorHandler } from '@sentry/react'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/shared/hooks/useTheme"
import { AuthProvider } from "@/features/auth/context/AuthContext"
import ErrorBoundary from "@/shared/components/ErrorBoundary"
import { ApiError } from "@/lib/apiClient"
import { MouseGlow } from "@/shared/components/MouseGlow"

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

createRoot(document.getElementById('root')!, {
    // React 19: route render errors caught by boundaries (and uncaught ones)
    // through to Sentry. Our own <ErrorBoundary> still renders the fallback UI.
    onUncaughtError: reactErrorHandler(),
    onCaughtError: reactErrorHandler(),
    onRecoverableError: reactErrorHandler(),
}).render(
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
