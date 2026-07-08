import { useEffect } from "react";
import { useRouteError } from "react-router-dom";

interface RouteErrorProps {
    name?: string;
}

const CHUNK_RELOAD_KEY = "gh_chunk_reload_at";
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

// A route chunk's hashed filename no longer exists on the server (superseded
// by a new deploy while this tab was open); the SPA fallback then serves
// index.html for it, which the module loader rejects as the wrong MIME type.
function isStaleChunkError(message: string) {
    // Each engine phrases the failed dynamic import differently:
    // Chrome "Failed to fetch dynamically imported module",
    // Firefox "error loading dynamically imported module",
    // Safari/WebKit "Importing a module script failed".
    return /dynamically imported module|importing a module script failed/i.test(message);
}

export default function RouteError({ name = "Application" }: RouteErrorProps) {
    const error = useRouteError();
    console.error(error);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = String((error as any)?.statusText || (error as any)?.message || "Unknown error");
    const isStaleChunk = isStaleChunkError(message);

    useEffect(() => {
        if (!isStaleChunk) return;
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (Date.now() - lastReload < CHUNK_RELOAD_COOLDOWN_MS) return;
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
    }, [isStaleChunk]);

    if (isStaleChunk) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
                <h1 className="text-2xl font-bold text-foreground mb-4">Updating to the latest version…</h1>
                <p className="text-slate-600">A new version of GeeksHub was just released. Reloading the page.</p>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h1>
            <p className="text-slate-600 mb-2">An error occurred in the {name}.</p>
            <p className="text-sm text-slate-400 font-mono mt-4">{message}</p>
        </div>
    );
}
