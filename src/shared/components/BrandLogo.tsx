import { cn } from "@/lib/utils";

interface BrandLogoProps {
    className?: string;
    imgClassName?: string;
}

/**
 * GeeksHub logo mark. Rendered on a white chip because the mark's
 * black outline disappears on dark or colored backgrounds.
 */
export default function BrandLogo({ className, imgClassName }: BrandLogoProps) {
    return (
        <div
            className={cn(
                "rounded-xl bg-white flex items-center justify-center shadow-lg shrink-0 overflow-hidden",
                className
            )}
        >
            <img
                src="/logo.svg"
                alt="GeeksHub"
                className={cn("w-[115%] h-[115%] max-w-none object-contain", imgClassName)}
            />
        </div>
    );
}
