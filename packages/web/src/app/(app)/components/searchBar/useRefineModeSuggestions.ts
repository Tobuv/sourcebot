'use client';

import { useMemo } from "react";
import { Suggestion } from "./searchSuggestionsBox";
import { SearchPrefix } from "./constants";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useTranslations } from "next-intl";

const negate = (prefix: SearchPrefix) => {
    return `-${prefix}`;
}

export const useRefineModeSuggestions = () => {
    const isSearchContextsEnabled = useHasEntitlement('search-contexts');
    const t = useTranslations('searchBar.refine');

    const suggestions = useMemo((): Suggestion[] => {
        return [
            ...(isSearchContextsEnabled ? [
                {
                    value: SearchPrefix.context,
                    description: t('context'),
                    spotlight: true,
                },
                {
                    value: negate(SearchPrefix.context),
                    description: t('contextNegated')
                },
            ] : []),
            {
                value: SearchPrefix.visibility,
                description: t('visibility')
            },
            {
                value: SearchPrefix.repo,
                description: t('repo'),
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.repo),
                description: t('repoNegated')
            },
            {
                value: SearchPrefix.lang,
                description: t('lang'),
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.lang),
                description: t('langNegated')
            },
            {
                value: SearchPrefix.file,
                description: t('file'),
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.file),
                description: t('fileNegated')
            },
            {
                value: SearchPrefix.rev,
                description: t('rev'),
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.rev),
                description: t('revNegated')
            },
            {
                value: SearchPrefix.sym,
                description: t('sym'),
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.sym),
                description: t('symNegated')
            },
            {
                value: SearchPrefix.content,
                description: t('content')
            },
            {
                value: negate(SearchPrefix.content),
                description: t('contentNegated')
            },
            {
                value: SearchPrefix.archived,
                description: t('archived'),
            },
            {
                value: SearchPrefix.fork,
                description: t('fork')
            },
        ];
    }, [isSearchContextsEnabled, t]);

    return suggestions;
}