/**
 * FeedbackProvider
 *
 * Mounts the feedback surfaces (the on-demand form + the throttled NPS prompt)
 * once at the app shell root, and exposes `openFeedbackForm()` so any child —
 * e.g. the "Send feedback" menu item — can open the form without prop-drilling.
 */

import * as React from "react";
import { FeedbackDialog } from "@/features/feedback/components/FeedbackDialog";
import { NpsPrompt } from "@/features/feedback/components/NpsPrompt";

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
            <FeedbackDialog open={formOpen} onOpenChange={setFormOpen} />
            <NpsPrompt />
        </FeedbackContext.Provider>
    );
}

/** Access the feedback controls. Safe no-op default keeps it usable outside the provider. */
export function useFeedbackWidget(): FeedbackContextValue {
    return React.useContext(FeedbackContext) ?? { openFeedbackForm: () => {} };
}
