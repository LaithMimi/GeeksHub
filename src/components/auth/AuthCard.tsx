import { type ReactNode, useRef, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface AuthCardProps {
    children: ReactNode;
    className?: string;
    /** Unique key to trigger animation on change (usually 'mode') */
    modeKey: string;
}

export default function AuthCard({ children, className, modeKey }: AuthCardProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | "auto">("auto");
    const prefersReducedMotion = useReducedMotion();

    // Measure height on change
    useEffect(() => {
        if (prefersReducedMotion) {
            setHeight("auto");
            return;
        }

        if (containerRef.current) {
            const resizeObserver = new ResizeObserver((entries) => {
                // We only care about the first entry
                const adjustedHeight = entries[0].contentRect.height;
                setHeight(adjustedHeight);
            });

            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [prefersReducedMotion, children]); // Re-run when children change


    return (
        <Card className={cn("w-full border-muted/40 shadow-xl backdrop-blur-sm bg-card/80 overflow-hidden transition-[height] duration-300 ease-in-out", className)}
            style={{ height: height === "auto" ? "auto" : `${height}px` }}
        >
            <CardContent className="p-0">
                <div
                    ref={containerRef}
                    className={cn(
                        "w-full transition-all duration-300 ease-in-out px-6 py-6",
                        // Apply animation classes only if not reduced motion
                        !prefersReducedMotion && "animate-in fade-in slide-in-from-bottom-4"
                    )}
                    key={modeKey} // Trigger remount/animation
                >
                    {children}
                </div>
            </CardContent>
        </Card>
    );
}
