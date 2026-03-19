import { useQuery } from "@tanstack/react-query";
import { getLearningPath, getActivitySummary } from "@/services/learningPathService";
import type { LearningPath, ActivitySummary } from "@/types/domain";
import { useAuth } from "@/context/AuthContext";

export const useMyLearningPath = () => {
    const { user } = useAuth();
    
    return useQuery<LearningPath>({
        queryKey: ["learning-path"],
        queryFn: getLearningPath,
        enabled: !!user,
        staleTime: 5 * 60 * 1000, // 5 minutes fresh
    });
};

export const useActivitySummary = () => {
    const { user } = useAuth();

    return useQuery<ActivitySummary>({
        queryKey: ["activity-summary"],
        queryFn: getActivitySummary,
        enabled: !!user,
        staleTime: 60 * 1000, // 1 minute fresh
    });
};
