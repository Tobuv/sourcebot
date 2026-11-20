import { cn } from "@/lib/utils";
import { NexusCodeMarkShapes } from "./nexusCodeMark";

interface SourcebotLogoProps {
    className?: string;
    size?: "small" | "large";
}

/**
 * Product logo. `small` is the square mark, `large` is the mark plus the
 * "NexusCode" wordmark. Sized by the caller's height/width classes.
 */
export const SourcebotLogo = ({ className, size = "large" }: SourcebotLogoProps) => {
    if (size === "small") {
        return (
            <svg
                viewBox="0 0 24 24"
                role="img"
                aria-label="NexusCode logo"
                className={cn("h-16 w-auto text-foreground", className)}
            >
                <NexusCodeMarkShapes />
            </svg>
        );
    }

    return (
        <NexusCodeWordmark className={cn("h-16 w-auto", className)} />
    );
}

export const NexusCodeWordmark = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 220 56"
        role="img"
        aria-label="NexusCode logo"
        className={cn("text-foreground", className)}
    >
        <g transform="translate(4 4) scale(2)">
            <NexusCodeMarkShapes />
        </g>
        <text
            x="64"
            y="39"
            fill="currentColor"
            fontSize="32"
            fontWeight="700"
            letterSpacing="-0.5"
            textLength="150"
            lengthAdjust="spacingAndGlyphs"
            style={{ fontFamily: "inherit" }}
        >
            NexusCode
        </text>
    </svg>
);
