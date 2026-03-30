import { useQuery } from "@tanstack/react-query";
import { getActivitySummary } from "@/services/learningPathService";
import type { ActivitySummary } from "@/types/domain";
import { useAuth } from "@/context/AuthContext";


export const useActivitySummary = () => {
    const { user } = useAuth();

    return useQuery<ActivitySummary>({
        queryKey: ["activity-summary"],
        queryFn: getActivitySummary,
        enabled: !!user,
        staleTime: 60 * 1000, // 1 minute fresh
    });
};
