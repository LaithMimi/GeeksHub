import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { logger } from "@/lib/logger";

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

export default function RouteError({ name = "page" }: RouteErrorProps) {
    const error = useRouteError();
    // Developer-only — the raw error is never shown to users in production.
    logger.error("[RouteError]", error);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMessage = String((error as any)?.statusText || (error as any)?.message || "");
    const isStaleChunk = isStaleChunkError(rawMessage);

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
                <h1 className="text-2xl font-bold text-foreground mb-3">Updating to the latest version…</h1>
                <p className="text-muted-foreground">A new version of GeeksHub was just released. Reloading now.</p>
            </div>
        );
    }

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-8" role="alert">
            <div className="text-center max-w-md">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                    <AlertTriangle className="h-6 w-6 text-red-500/80" aria-hidden="true" />
                </div>
                <h1 className="text-[22px] font-display font-bold text-foreground">This {name} didn't load</h1>
                <p className="text-[14px] text-muted-foreground mt-2 max-w-sm mx-auto">
                    Something went wrong while loading this {name}. It's not your fault — try again, and if it
                    keeps happening, head back home.
                </p>
                <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-foreground text-[14px] font-medium hover:opacity-90 transition-opacity"
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Try again
                    </button>
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground text-[14px] font-medium hover:bg-foreground/5 transition-colors"
                    >
                        <Home className="h-4 w-4" aria-hidden="true" />
                        Go home
                    </a>
                </div>
                {import.meta.env.DEV && rawMessage && (
                    <pre className="mt-6 p-3 rounded-xl bg-foreground/5 border border-border text-[12px] text-muted-foreground text-left overflow-auto max-h-32">
                        {rawMessage}
                    </pre>
                )}
            </div>
        </div>
    );
}
