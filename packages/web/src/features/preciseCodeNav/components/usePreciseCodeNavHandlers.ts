'use client';

import { useBrowseState } from "@/app/(app)/browse/hooks/useBrowseState";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { findPreciseRelatedSymbols } from "../client";
import { PreciseFileMatches, PreciseMatch, SymbolPosition } from "../types";
import { PreciseCodeNavHandlers } from "./preciseCodeNavExtension";
import { useTranslations } from "next-intl";

export const getPreciseMatchBrowsePath = (file: PreciseFileMatches, match: PreciseMatch) => getBrowsePath({
    repoName: file.repoName,
    revisionName: file.revisionName,
    path: file.path,
    pathType: 'blob',
    highlightRange: {
        start: { lineNumber: match.line + 1, column: match.startChar + 1 },
        end: { lineNumber: match.endLine + 1, column: match.endChar + 1 },
    },
});

/**
 * Returns a stable ref with the handlers used by `preciseCodeNavExtension`.
 */
export const usePreciseCodeNavHandlers = () => {
    const router = useRouter();
    const { toast } = useToast();
    const { updateBrowseState } = useBrowseState();
    const t = useTranslations('preciseNav');

    const handlers = useMemo<PreciseCodeNavHandlers>(() => {
        const openExplorePanel = (position: SymbolPosition, displayName: string, tab: 'references' | 'definitions') => {
            updateBrowseState({
                preciseSymbolInfo: { ...position, displayName },
                selectedSymbolInfo: undefined,
                isBottomPanelCollapsed: false,
                activeBottomPanelTab: 'explore',
                activeExploreMenuTab: tab,
            });
        }

        return {
            labels: {
                local: t('local'),
                precise: t('precise'),
                preciseTitle: t('preciseTitle'),
                goToDefinition: t('goToDefinition'),
                findReferences: t('findReferences'),
            },
            onFindReferences: (position, displayName) => {
                openExplorePanel(position, displayName, 'references');
            },
            onGoToDefinition: async (position, displayName) => {
                const response = await findPreciseRelatedSymbols({ ...position, kind: 'definitions' });
                if (isServiceError(response) || !response) {
                    toast({ description: t('resolveFailed', { name: displayName }) });
                    return;
                }

                const matches = response.files.flatMap((file) => file.matches.map((match) => ({ file, match })));
                if (matches.length === 0) {
                    toast({ description: t('noDefinitionFor', { name: displayName }) });
                    return;
                }

                if (matches.length === 1) {
                    const { file, match } = matches[0];
                    router.push(getPreciseMatchBrowsePath(file, match));
                    return;
                }

                openExplorePanel(position, displayName, 'definitions');
            },
        };
    }, [router, toast, updateBrowseState, t]);

    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    return handlersRef;
}
