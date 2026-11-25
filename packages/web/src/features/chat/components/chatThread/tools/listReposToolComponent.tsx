'use client';

import { ListReposMetadata, ToolResult } from "@/features/tools";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";

export const ListReposToolComponent = ({ metadata }: ToolResult<ListReposMetadata>) => {
    const t = useTranslations('chatTools');
    const count = metadata.repos.length;
    const label = metadata.totalCount > count ? t('reposOfTotal', { count, total: metadata.totalCount }) : t('repos', { count });

    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <span className="flex-shrink-0">{t('listedRepositories')}</span>
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{label}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
