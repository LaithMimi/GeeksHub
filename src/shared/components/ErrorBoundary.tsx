import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Developer-only — silent in production so internals never leak to DevTools.
        logger.error("[ErrorBoundary]", error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-8" role="alert">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden="true" />
                        </div>
                        <h1 className="text-[24px] font-display font-bold text-foreground">Something went wrong</h1>
                        <p className="text-[14px] text-muted-foreground mt-2 max-w-sm mx-auto">
                            The app hit an unexpected problem — this is on us, not you. Try again, and if it keeps
                            happening, please contact support.
                        </p>
                        {/* Raw error is shown only in development, never to real users. */}
                        {import.meta.env.DEV && this.state.error && (
                            <pre className="mt-4 p-3 rounded-xl bg-foreground/5 border border-border text-[12px] text-muted-foreground text-left overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                        <button
                            onClick={this.handleReset}
                            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-foreground text-[14px] font-medium hover:opacity-90 transition-opacity"
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            Try again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
