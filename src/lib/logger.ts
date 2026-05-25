/**
 * Production-safe logger. In development it forwards to the console; in
 * production it stays silent so raw error objects, stack traces, and API
 * response bodies are never exposed via DevTools. Wire a monitoring service
 * (e.g. Sentry) into the production branch when one is available.
 */
const isDev = import.meta.env.DEV;

export const logger = {
    error: (...args: unknown[]) => {
        if (isDev) console.error(...args);
    },
    warn: (...args: unknown[]) => {
        if (isDev) console.warn(...args);
    },
};
