/** Initials from a name, ignoring common title prefixes (Dr, Prof, …). */
const getInitials = (name: string): string =>
    name.replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, "")
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

/** Small initials avatar used in directory lists/panels. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
    const dim = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[13px]";
    return (
        <div
            className={`${dim} shrink-0 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center font-display font-semibold text-blue-300`}
        >
            {getInitials(name)}
        </div>
    );
}
