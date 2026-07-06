import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getActivitySummary } from "@/features/gamification/api/learningPathService";
import type { ActivitySummary } from "@/types/domain";
import { useAuth } from "@/features/auth/context/AuthContext";


export const useActivitySummary = () => {
    const { user } = useAuth();

    return useQuery<ActivitySummary>({
        queryKey: queryKeys.activity.summary(),
        queryFn: getActivitySummary,
        enabled: !!user,
        staleTime: 60 * 1000, // 1 minute fresh
    });
};
