import { useRouteError } from "react-router-dom";

interface RouteErrorProps {
    name?: string;
}

export default function RouteError({ name = "Application" }: RouteErrorProps) {
    const error = useRouteError();
    console.error(error);

    return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h1>
            <p className="text-slate-600 mb-2">An error occurred in the {name}.</p>
            <p className="text-sm text-slate-400 font-mono mt-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(error as any)?.statusText || (error as any)?.message || "Unknown error"}
            </p>
        </div>
    );
}
