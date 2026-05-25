export function SummaryChip({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] text-muted-foreground/50">{label}</span>
            <span className="text-[11px] text-blue-300 font-medium">{value}</span>
        </div>
    );
}
