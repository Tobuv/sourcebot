import { BLAME_AGE_BG_CLASSES } from "./blameAgeColors";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export const BlameAgeLegend = () => {
    const t = useTranslations('browse');
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('older')}</span>
            <div className="flex items-center gap-px">
                {BLAME_AGE_BG_CLASSES.map((bg, i) => (
                    <div
                        key={i}
                        className={cn('h-2 w-2', bg)}
                    />
                ))}
            </div>
            <span>{t('newer')}</span>
        </div>
    );
};
