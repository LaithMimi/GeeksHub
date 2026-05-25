import type { Task } from "@/features/dashboard/hooks/useTasks";

const CONFIG: Record<Task["priority"], { label: string; className: string }> = {
    urgent: { label: "Urgent", className: "bg-red-500/20 text-red-400 border-red-500/20" },
    high:   { label: "High",   className: "bg-amber-500/20 text-amber-400 border-amber-500/20" },
    normal: { label: "Pending", className: "border-border text-muted-foreground/50" },
};

export function PriorityBadge({ priority }: { priority: Task["priority"] }) {
    const { label, className } = CONFIG[priority];
    return (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${className}`}>
            {label}
        </span>
    );
}
