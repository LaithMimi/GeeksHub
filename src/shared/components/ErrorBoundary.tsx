import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="h-7 w-7 text-red-400" />
                        </div>
                        <h1 className="text-[24px] font-display font-bold text-foreground">Something went wrong</h1>
                        <p className="text-[14px] text-muted-foreground mt-2 max-w-sm mx-auto">
                            An unexpected error occurred. Try refreshing, or contact support if the problem persists.
                        </p>
                        {this.state.error && (
                            <pre className="mt-4 p-3 rounded-xl bg-foreground/5 border border-border text-[12px] text-red-400/80 text-left overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                        <button
                            onClick={this.handleReset}
                            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-foreground text-[14px] font-medium hover:opacity-90 transition-opacity"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
