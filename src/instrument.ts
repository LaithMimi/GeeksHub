/**
 * ============================================================================
 * SENTRY INITIALIZATION
 * ============================================================================
 *
 * Imported FIRST in main.tsx (before any other module) so Sentry can hook the
 * runtime before app code runs. Kept in its own file per the Sentry React SDK
 * setup guide.
 *
 * No-op until VITE_SENTRY_DSN is set, so local/dev and un-provisioned
 * environments send nothing. Set VITE_SENTRY_DSN in the production environment
 * to turn it on. Session Replay masks all text and blocks media so we never
 * ship user content or the HttpOnly auth cookie to Sentry.
 * ============================================================================
 */

import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

Sentry.init({
    dsn,
    // Only report from real deployments that have a DSN configured.
    enabled: import.meta.env.PROD && !!dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,

    // Never attach PII (emails, cookies) to events — matches the platform's
    // no-leak posture. Replay masking below is the second line of defence.
    sendDefaultPii: false,

    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
    ],

    // Performance tracing — 10% of transactions in production.
    tracesSampleRate: 0.1,
    // Propagate trace headers to our own API only (enables backend correlation
    // once the FastAPI SDK is added). Add the production API origin here.
    tracePropagationTargets: ["localhost", /^\/api\//],

    // Session Replay — sample 10% of sessions, but 100% of sessions with an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});
