import { cn } from "@/lib/utils";

interface BrandLogoProps {
    className?: string;
    imgClassName?: string;
}

/**
 * GeeksHub logo mark.
 *
 * The mark has a black outline that vanishes on dark backgrounds, so in
 * light mode it sits on a white chip. In dark mode the chip becomes
 * transparent (blending with the app background) and we swap to a variant
 * whose outline is white so the mark stays legible.
 */
export default function BrandLogo({ className, imgClassName }: BrandLogoProps) {
    return (
        <div
            className={cn(
                "rounded-xl flex items-center justify-center shrink-0 overflow-hidden",
                "bg-transparent shadow-none",
                className
            )}
        >
            {/* Light mode: black-outlined mark on white chip */}
            <img
                src="/logo.svg"
                alt="GeeksHub"
                className={cn(
                    "w-[115%] h-[115%] max-w-none object-contain block dark:hidden",
                    imgClassName
                )}
            />
            {/* Dark mode: white-outlined mark on transparent chip */}
            <img
                src="/logo-dark.svg"
                alt="GeeksHub"
                aria-hidden="true"
                className={cn(
                    "w-[115%] h-[115%] max-w-none object-contain hidden dark:block",
                    imgClassName
                )}
            />
        </div>
    );
}
