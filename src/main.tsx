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

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './lib/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/hooks/useTheme"
import { AuthProvider } from "@/context/AuthContext"
import ErrorBoundary from "@/components/ErrorBoundary"

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
