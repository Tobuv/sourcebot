import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"


interface TextSeparatorProps {
    className?: string;
    text?: string;
}

export const TextSeparator = ({ className, text }: TextSeparatorProps) => {
    const t = useTranslations('common');
    return (
        <div className={cn("flex items-center w-full gap-4", className)}>
            <div className="h-[1px] flex-1 bg-border" />
            <span className="text-muted-foreground text-sm">{text ?? t('or')}</span>
            <div className="h-[1px] flex-1 bg-border" />
        </div>
    )
}