'use client';

import { useBrowseState } from "@/app/(app)/browse/hooks/useBrowseState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { LowProfileTabsTrigger } from "@/components/ui/tab-switcher";
import { isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { findPreciseRelatedSymbols } from "../client";
import { PreciseFileMatches, PreciseMatch, PreciseRelatedSymbolsResponse, SymbolPosition } from "../types";
import { getPreciseMatchBrowsePath } from "./usePreciseCodeNavHandlers";

interface PreciseExploreMenuProps {
    symbol: SymbolPosition & { displayName: string };
}

const useRelatedSymbols = ({ repoName, revisionName, path, line, character }: SymbolPosition, kind: 'definitions' | 'references') => {
    return useQuery({
        queryKey: ['precise-related-symbols', kind, repoName, revisionName, path, line, character],
        queryFn: async (): Promise<PreciseRelatedSymbolsResponse> => {
            const response = await findPreciseRelatedSymbols({ repoName, revisionName, path, line, character, kind });
            if (isServiceError(response)) {
                throw new Error(response.message);
            }
            return response ?? { matchCount: 0, truncated: false, files: [] };
        },
        staleTime: 60 * 1000,
    });
}

export const PreciseExploreMenu = ({ symbol }: PreciseExploreMenuProps) => {
    const { state: { activeExploreMenuTab }, updateBrowseState } = useBrowseState();
    const references = useRelatedSymbols(symbol, 'references');
    const definitions = useRelatedSymbols(symbol, 'definitions');
    const active = activeExploreMenuTab === 'definitions' ? definitions : references;

    const countLabel = (count?: number, truncated?: boolean) => count === undefined ? '' : ` (${count}${truncated ? '+' : ''})`;

    return (
        <div className="flex flex-row h-full">
            <div className="flex flex-col w-56 shrink-0 p-2 gap-2 border-r">
                <div className="flex flex-col gap-0.5 px-1">
                    <span className="font-mono text-sm font-semibold truncate" title={symbol.displayName}>{symbol.displayName}</span>
                    <span className="text-xs text-muted-foreground">Precise code navigation</span>
                </div>
                <Tabs
                    value={activeExploreMenuTab}
                    orientation="vertical"
                >
                    <TabsList className="flex flex-col h-auto items-start p-0 bg-transparent">
                        <LowProfileTabsTrigger
                            value="references"
                            onClick={() => updateBrowseState({ activeExploreMenuTab: 'references' })}
                        >
                            References{countLabel(references.data?.matchCount, references.data?.truncated)}
                        </LowProfileTabsTrigger>
                        <LowProfileTabsTrigger
                            value="definitions"
                            onClick={() => updateBrowseState({ activeExploreMenuTab: 'definitions' })}
                        >
                            Definitions{countLabel(definitions.data?.matchCount, definitions.data?.truncated)}
                        </LowProfileTabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            <ScrollArea className="flex-1 h-full">
                {active.isPending ? (
                    <div className="flex flex-col gap-2 p-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-6 w-full" />
                        ))}
                    </div>
                ) : active.isError ? (
                    <p className="p-4 text-sm text-destructive">Failed to load results: {active.error.message}</p>
                ) : active.data.files.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                        {activeExploreMenuTab === 'definitions'
                            ? 'No definition found. It may be defined in a dependency that isn\'t indexed.'
                            : 'No references found.'}
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {active.data.truncated && (
                            <p className="px-3 py-1 text-xs text-muted-foreground">Showing the first {active.data.matchCount} results.</p>
                        )}
                        {active.data.files.map((file) => (
                            <FileMatches
                                key={`${file.repoId}:${file.revisionName}:${file.path}`}
                                file={file}
                                showRepo={file.repoName !== symbol.repoName}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}

const FileMatches = ({ file, showRepo }: { file: PreciseFileMatches, showRepo: boolean }) => {
    return (
        <div className="flex flex-col">
            <div className="sticky top-0 z-10 bg-background flex flex-row items-center gap-2 px-3 py-1 text-xs">
                {showRepo && (
                    <span className="text-muted-foreground">{file.repoDisplayName ?? file.repoName}</span>
                )}
                <span className="font-medium truncate" title={file.path}>{file.path}</span>
                <span className="text-muted-foreground">{file.matches.length}</span>
            </div>
            <Separator />
            {file.matches.map((match) => (
                <MatchRow
                    key={`${match.line}:${match.startChar}`}
                    file={file}
                    match={match}
                />
            ))}
        </div>
    );
}

const MatchRow = ({ file, match }: { file: PreciseFileMatches, match: PreciseMatch }) => {
    const router = useRouter();

    const [before, highlighted, after] = useMemo(() => {
        const content = match.lineContent;
        const end = match.endLine === match.line ? match.endChar : content.length;
        return [content.slice(0, match.startChar), content.slice(match.startChar, end), content.slice(end)];
    }, [match]);

    // Trim leading indentation, but keep the highlight intact.
    const indentation = before.length - before.trimStart().length;

    return (
        <button
            type="button"
            className="flex flex-row items-baseline gap-3 px-3 py-0.5 text-left hover:bg-accent font-mono text-xs w-full"
            onClick={() => router.push(getPreciseMatchBrowsePath(file, match))}
        >
            <span className="w-10 shrink-0 text-right text-muted-foreground">{match.line + 1}</span>
            <span className="truncate">
                {before.slice(indentation)}
                <span className="bg-yellow-200 dark:bg-yellow-700/60 rounded-sm">{highlighted}</span>
                {after}
            </span>
            {match.isDefinition && (
                <span className="ml-auto shrink-0 text-[10px] uppercase text-muted-foreground">definition</span>
            )}
        </button>
    );
}
