import { useEffect, useRef } from "react";

export function MouseGlow() {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let frameId: number;
        
        const updateMousePosition = (e: MouseEvent) => {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                if (!divRef.current) return;
                divRef.current.style.setProperty("--mouse-x", `${e.clientX}px`);
                divRef.current.style.setProperty("--mouse-y", `${e.clientY}px`);
            });
        };

        window.addEventListener("mousemove", updateMousePosition, { passive: true });
        return () => {
            window.removeEventListener("mousemove", updateMousePosition);
            if (frameId) cancelAnimationFrame(frameId);
        };
    }, []);

    return (
        <div
            ref={divRef}
            className="pointer-events-none fixed inset-0 z-[-1] transition-opacity duration-300 hidden sm:block delay-150"
            style={{
                background: "radial-gradient(circle 300px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(37, 99, 235, 0.15), transparent 40%)"
            }}
        />
    );
}
