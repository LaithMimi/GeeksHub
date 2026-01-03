/**
 * ============================================================================
 * APPLICATION ENTRY POINT
 * ============================================================================
 * 
 * This file bootstraps the React application with:
 * - React Router for navigation
 * - TanStack Query for data fetching
 * - Sonner for toast notifications
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * When the backend is implemented, you may need these changes:
 * 
 * 1. CONFIGURE QUERY CLIENT for production:
 *    ```ts
 *    const queryClient = new QueryClient({
 *        defaultOptions: {
 *            queries: {
 *                staleTime: 1000 * 60, // 1 minute default
 *                retry: (failureCount, error) => {
 *                    // Don't retry on 401/403 (auth errors)
 *                    if (error instanceof ApiError && [401, 403].includes(error.status)) {
 *                        return false;
 *                    }
 *                    return failureCount < 3;
 *                },
 *            },
 *        },
 *    });
 *    ```
 * 
 * 2. ADD AUTHENTICATION PROVIDER:
 *    Wrap the app with your auth provider (e.g., Auth0, Firebase, custom):
 *    ```tsx
 *    <AuthProvider>
 *        <QueryClientProvider client={queryClient}>
 *            <RouterProvider router={router} />
 *        </QueryClientProvider>
 *    </AuthProvider>
 *    ```
 * 
 * 3. CONFIGURE API BASE URL:
 *    In your apiClient.ts, read from environment:
 *    ```ts
 *    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
 *    ```
 * 
 * 4. REACT QUERY DEVTOOLS (optional, dev only):
 *    ```tsx
 *    import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
 *    // Add inside QueryClientProvider:
 *    <ReactQueryDevtools initialIsOpen={false} />
 *    ```
 * ============================================================================
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './lib/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/sonner"

// Create QueryClient instance
// TODO: Configure with production defaults when backend is ready
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
