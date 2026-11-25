'use client';

import { ListCommitsMetadata, ToolResult } from "@/features/tools";
import { RepoBadge } from "./repoBadge";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";

export const ListCommitsToolComponent = ({ metadata }: ToolResult<ListCommitsMetadata>) => {
    const t = useTranslations('chatTools');
    const count = metadata.commits.length;
    const label = t('commits', { count });

    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <span className="flex-shrink-0">{t('listedCommitsBefore')}</span>
            <RepoBadge repo={metadata.repoInfo} />
            {t('listedCommitsAfter').trim() && <span className="flex-shrink-0">{t('listedCommitsAfter')}</span>}
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{label}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
