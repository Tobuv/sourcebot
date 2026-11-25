import { BookMarkedIcon, LibraryBigIcon, ScanSearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export const SearchScopeInfoCard = () => {
    const t = useTranslations('chatBox');
    return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-4 w-80 max-w-[90vw]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                <ScanSearchIcon className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-popover-foreground">{t('scopeCardTitle')}</h4>
            </div>
            <div className="text-sm text-popover-foreground leading-relaxed">
                {t('scopeCardIntro')}
                <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <BookMarkedIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{t.rich('scopeCardRepository', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <LibraryBigIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{t.rich('scopeCardReposet', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}; 