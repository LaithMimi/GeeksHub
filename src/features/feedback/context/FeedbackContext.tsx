/**
 * FeedbackProvider
 *
 * Mounts the feedback surfaces (the on-demand form + the throttled NPS prompt)
 * once at the app shell root, and exposes `openFeedbackForm()` so any child —
 * e.g. the "Send feedback" menu item — can open the form without prop-drilling.
 */

import * as React from "react";

// Lazy so the provider (imported eagerly by the router) doesn't drag the dialog
// components — and their dependency tree — into the main bundle.
const FeedbackDialog = React.lazy(() =>
    import("@/features/feedback/components/FeedbackDialog").then((m) => ({ default: m.FeedbackDialog })),
);
const NpsPrompt = React.lazy(() =>
    import("@/features/feedback/components/NpsPrompt").then((m) => ({ default: m.NpsPrompt })),
);

interface FeedbackContextValue {
    openFeedbackForm: () => void;
}

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
    const [formOpen, setFormOpen] = React.useState(false);

    const value = React.useMemo<FeedbackContextValue>(
        () => ({ openFeedbackForm: () => setFormOpen(true) }),
        [],
    );

    return (
        <FeedbackContext.Provider value={value}>
            {children}
            <React.Suspense fallback={null}>
                <FeedbackDialog open={formOpen} onOpenChange={setFormOpen} />
                <NpsPrompt />
            </React.Suspense>
        </FeedbackContext.Provider>
    );
}

/** Access the feedback controls. Safe no-op default keeps it usable outside the provider. */
export function useFeedbackWidget(): FeedbackContextValue {
    return React.useContext(FeedbackContext) ?? { openFeedbackForm: () => {} };
}
