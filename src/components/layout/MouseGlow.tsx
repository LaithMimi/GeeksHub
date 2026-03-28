import { useEffect } from "react";

export function MouseGlow() {
    useEffect(() => {
        const updateMousePosition = (e: MouseEvent) => {
            document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
            document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
        };

        window.addEventListener("mousemove", updateMousePosition);
        return () => window.removeEventListener("mousemove", updateMousePosition);
    }, []);

    return (
        <div 
            className="pointer-events-none fixed inset-0 z-[-1] transition-opacity duration-300 hidden sm:block delay-150"
            style={{
                background: "radial-gradient(circle 600px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139, 92, 246, 0.15), transparent 40%)"
            }}
        />
    );
}
