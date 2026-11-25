import { format } from "date-fns";
import { GitCommitHorizontal } from "lucide-react";
import Link from "next/link";
import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getPathType, listCommitAuthors, listCommits } from "@/features/git";
import { isServiceError } from "@/lib/utils";
import { AuthorFilter } from "./authorFilter";
import { dedupeCommitAuthorsByEmail, escapeGitBreLiteral } from "@/app/(app)/browse/components/commitAuthors";
import { CommitRow } from "./commitRow";
import { CommitsPagination } from "./commitsPagination";
import { DateFilter } from "./dateFilter";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getDateFnsLocale } from "@/i18n/dateLocale";

interface CommitsPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
    page: number;
    author?: string;
    since?: string;
    until?: string;
}

const COMMITS_PER_PAGE = 35;
const AUTHORS_PER_PAGE = 100;

export const CommitsPanel = async ({ path, repoName, revisionName, page, author, since, until }: CommitsPanelProps) => {
    const t = await getTranslations('browse');
    const dateLocale = getDateFnsLocale(await getLocale());
    const skip = (page - 1) * COMMITS_PER_PAGE;

    // The URL stores dates as YYYY-MM-DD. Always pass explicit timestamps to
    // git: the bare-date form triggers approxidate quirks (returning 0 commits
    // in some cases), and bare `--until=YYYY-MM-DD` would also exclude commits
    // made on that day since it resolves to midnight at the start.
    const sinceForGit = since ? `${since}T00:00:00` : undefined;
    const untilForGit = until ? `${until}T23:59:59` : undefined;

    const [commitsResponse, repoInfoResponse, authorsResponse, pathTypeResponse] = await Promise.all([
        listCommits({
            repo: repoName,
            path: path || undefined,
            ref: revisionName,
            author: author ? escapeGitBreLiteral(author) : undefined,
            since: sinceForGit,
            until: untilForGit,
            maxCount: COMMITS_PER_PAGE,
            skip,
        }),
        getRepoInfoByName(repoName),
        listCommitAuthors({
            repo: repoName,
            path: path || undefined,
            ref: revisionName,
            maxCount: AUTHORS_PER_PAGE,
            skip: 0,
        }),
        getPathType({
            repo: repoName,
            ref: revisionName,
            path,
        }),
    ]);

    if (isServiceError(commitsResponse)) {
        return <div className="p-4 text-sm">{t('errorLoadingCommits', { message: commitsResponse.message })}</div>;
    }
    if (isServiceError(repoInfoResponse)) {
        return <div className="p-4 text-sm">{t('errorLoadingRepoInfo', { message: repoInfoResponse.message })}</div>;
    }
    if (isServiceError(authorsResponse)) {
        return <div className="p-4 text-sm">{t('errorLoadingCommitAuthors', { message: authorsResponse.message })}</div>;
    }
    // Fall back to 'blob' if the lookup fails so PathHeader still renders.
    const headerPathType = isServiceError(pathTypeResponse) ? 'blob' : pathTypeResponse;

    const authors = dedupeCommitAuthorsByEmail(authorsResponse.authors);
    const { commits, totalCount } = commitsResponse;
    const isLastPage = page * COMMITS_PER_PAGE >= totalCount;
    const hasFilters = Boolean(author || since || until);
    const isEmpty = commits.length === 0;
    const clearFiltersHref = getBrowsePath({
        repoName,
        revisionName,
        path,
        pathType: 'commits',
    });

    const groups = new Map<string, { label: string; commits: typeof commits }>();
    for (const commit of commits) {
        const date = new Date(commit.date);
        const key = format(date, "yyyy-MM-dd");
        const label = t('commitsOn', { date: format(date, 'PP', { locale: dateLocale }) });
        const existing = groups.get(key);
        if (existing) {
            existing.commits.push(commit);
        } else {
            groups.set(key, { label, commits: [commit] });
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row py-1 px-2 items-center justify-between gap-2">
                <div className="flex flex-row items-center gap-2 min-w-0">
                    <span className="text-sm text-muted-foreground flex-shrink-0">{t('historyFor')}</span>
                    <PathHeader
                        path={path}
                        pathType={headerPathType}
                        repo={{
                            name: repoName,
                            codeHostType: repoInfoResponse.codeHostType,
                            displayName: repoInfoResponse.displayName,
                            externalWebUrl: repoInfoResponse.externalWebUrl,
                        }}
                        revisionName={revisionName}
                        isFileIconVisible={headerPathType === 'blob'}
                    />
                </div>
                <div className="flex flex-row items-center gap-2 flex-shrink-0">
                    <AuthorFilter authors={authors} selectedAuthor={author} />
                    <DateFilter since={since} until={until} />
                </div>
            </div>
            <Separator />
            <div className="flex-1 overflow-auto">
                {isEmpty ? (
                    hasFilters ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <p className="text-sm text-muted-foreground">{t('noCommitsMatchFilters')}</p>
                            <Button asChild variant="outline" size="sm">
                                <Link href={clearFiltersHref}>{t('clearFilters')}</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            {t('noCommitsFound')}
                        </div>
                    )
                ) : (
                    <>
                        {Array.from(groups.values()).map((group) => (
                            <div key={group.label}>
                                <div className="sticky top-0 z-10 flex flex-row items-center gap-2 px-3 py-2 bg-muted text-sm font-medium text-muted-foreground border-b">
                                    <GitCommitHorizontal className="h-4 w-4 flex-shrink-0" />
                                    {group.label}
                                </div>
                                {group.commits.map((commit) => (
                                    <CommitRow
                                        key={commit.hash}
                                        commit={commit}
                                        repoName={repoName}
                                        revisionName={revisionName}
                                    />
                                ))}
                            </div>
                        ))}
                        {isLastPage && (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                {t('endOfHistory')}
                            </div>
                        )}
                        <CommitsPagination
                            page={page}
                            perPage={COMMITS_PER_PAGE}
                            totalCount={totalCount}
                            extraParams={{ author, since, until }}
                        />
                    </>
                )}
            </div>
        </div>
    );
};
