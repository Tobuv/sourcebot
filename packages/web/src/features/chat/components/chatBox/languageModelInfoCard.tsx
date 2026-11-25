import { BotIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export const LanguageModelInfoCard = () => {
    const t = useTranslations('chatBox');
    return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-4 w-80 max-w-[90vw]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                <BotIcon className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-popover-foreground">{t('modelCardTitle')}</h4>
            </div>
            <div className="text-sm text-popover-foreground leading-relaxed">
                {t.rich('modelCardIntro', { link: (chunks) => <Link href="https://docs.sourcebot.dev/docs/configuration/language-model-providers" target="_blank" className="text-link">{chunks}</Link> })}
            </div>
        </div>
    );
}; 