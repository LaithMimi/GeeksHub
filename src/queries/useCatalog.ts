/**
 * ============================================================================
 * CATALOG QUERY HOOKS
 * ============================================================================
 * 
 * TanStack Query hooks for catalog data (majors, semesters, courses, lecturers).
 * These hooks consume the catalogService and provide caching, loading states,
 * and automatic refetching.
 * 
 * ============================================================================
 * BACKEND MIGRATION GUIDE
 * ============================================================================
 * 
 * ✅ NO CHANGES NEEDED when backend is implemented!
 * 
 * These hooks call service functions which return Promises. When you update
 * the service layer to call real API endpoints, these hooks will continue
 * to work without modification.
 * 
 * The only potential changes:
 * 
 * 1. AUTHENTICATION: If your backend requires auth tokens, you may need to
 *    configure the QueryClient with default headers or use a request interceptor
 *    in your apiClient.ts (not here).
 * 
 * 2. STALE TIME: Adjust staleTime based on how often backend data changes:
 *    - Static data (majors, years): staleTime: Infinity
 *    - Dynamic data (courses): staleTime: 1000 * 60 * 5 (5 minutes)
 * 
 * 3. ERROR HANDLING: Consider adding global error handling in QueryClient:
 *    ```ts
 *    const queryClient = new QueryClient({
 *        defaultOptions: {
 *            queries: {
 *                retry: (failureCount, error) => {
 *                    if (error.status === 401) return false; // Don't retry on auth errors
 *                    return failureCount < 3;
 *                },
 *                onError: (error) => {
 *                    // Global error toast
 *                }
 *            }
 *        }
 *    });
 *    ```
 * 
 * 4. OPTIMISTIC UPDATES: For mutations, you may want to add optimistic updates
 *    to improve UX. See TanStack Query docs for details.
 * ============================================================================
 */

import { useQuery } from "@tanstack/react-query";
import { listMajors, listYears, listSemesters, listCourses, listLecturers, getCourse } from "@/services/catalogService";

/**
 * Fetches all majors. Cached indefinitely as majors rarely change.
 */
export const useMajors = () => useQuery({
    queryKey: ['majors'],
    queryFn: listMajors,
    staleTime: Infinity // Static data - adjust if majors can change
});

/**
 * Fetches academic years. Currently always enabled as years are static.
 * @param majorId - Optional filter (for future use)
 */
export const useYears = (majorId?: string) => useQuery({
    queryKey: ['years', majorId],
    queryFn: () => listYears(majorId),
    enabled: !!majorId || true // Always enabled for now as years are static
});

/**
 * Fetches semesters. Only fetches when majorId is provided.
 * @param majorId - Filter by major (enables cascading dropdown)
 */
export const useSemesters = (majorId?: string) => useQuery({
    queryKey: ['semesters', majorId],
    queryFn: () => listSemesters(majorId),
    enabled: !!majorId
});

/**
 * Fetches courses with filters. Only fetches when majorId is provided.
 * @param filters - Filter by majorId, yearId, semesterId
 */
export const useCourses = (filters: Parameters<typeof listCourses>[0]) => useQuery({
    queryKey: ['courses', filters],
    queryFn: () => listCourses(filters),
    enabled: !!filters.majorId
});

/**
 * Fetches a single course by ID.
 * @param courseId - The course ID to fetch
 */
export const useCourse = (courseId: string) => useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId),
    enabled: !!courseId
});

/**
 * Fetches lecturers for a course. Only fetches when courseId is provided.
 * @param filters - Filter by courseId
 */
export const useLecturers = (filters: Parameters<typeof listLecturers>[0]) => useQuery({
    queryKey: ['lecturers', filters],
    queryFn: () => listLecturers(filters),
    enabled: !!filters.courseId
});
