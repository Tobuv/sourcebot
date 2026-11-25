"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { cva } from "class-variance-authority"
import { AlertCircle, ArrowUpDown, PlusCircleIcon, RefreshCwIcon } from "lucide-react"
import * as React from "react"
import { CopyIconButton } from "../../components/copyIconButton"
import { useMemo } from "react"
import { LightweightCodeHighlighter } from "../../components/lightweightCodeHighlighter"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/hooks/use-toast"
import { DisplayDate } from "../../components/DisplayDate"
import { LoadingButton } from "@/components/ui/loading-button"
import { indexRepo } from "@/features/workerApi/actions"
import { isServiceError } from "@/lib/utils"
import { useTranslations } from "next-intl";

// @see: https://v0.app/chat/repo-indexing-status-uhjdDim8OUS

export type RepoIndexingJob = {
    id: string
    type: "INDEX" | "CLEANUP"
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
    createdAt: Date
    updatedAt: Date
    completedAt: Date | null
    errorMessage: string | null
}

const statusBadgeVariants = cva("", {
    variants: {
        status: {
            PENDING: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            IN_PROGRESS: "bg-primary text-primary-foreground hover:bg-primary/90",
            COMPLETED: "bg-green-600 text-white hover:bg-green-700",
            FAILED: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        },
    },
})

const getStatusBadge = (status: RepoIndexingJob["status"]) => {

    return <Badge className={statusBadgeVariants({ status })}><StatusLabel status={status} /></Badge>
}

const getTypeBadge = (type: RepoIndexingJob["type"]) => {
    return (
        <Badge variant="outline" className="font-mono">
            {type}
        </Badge>
    )
}

const getDuration = (start: Date, end: Date | null) => {
    if (!end) return "-"
    const diff = end.getTime() - start.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s`
}

export const columns: ColumnDef<RepoIndexingJob>[] = [
    {
        accessorKey: "type",
        header: () => <Label id="colType" />,
        cell: ({ row }) => getTypeBadge(row.getValue("type")),
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
    {
        accessorKey: "status",
        header: () => <SharedLabel id="colStatus" />,
        cell: ({ row }) => {
            const job = row.original
            return (
                <div className="flex items-center gap-2">
                    {getStatusBadge(row.getValue("status"))}
                    {job.errorMessage && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[750px] max-h-96 overflow-scroll">
                                    <LightweightCodeHighlighter
                                        language="text"
                                        lineNumbers={true}
                                        renderWhitespace={false}
                                    >
                                        {job.errorMessage}
                                    </LightweightCodeHighlighter>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            )
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => {
            return (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    <SharedLabel id="colStarted" />
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <DisplayDate date={row.getValue("createdAt") as Date} className="ml-3" />,
    },
    {
        accessorKey: "completedAt",
        header: ({ column }) => {
            return (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    <SharedLabel id="colCompleted" />
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const completedAt = row.getValue("completedAt") as Date | null;
            if (!completedAt) {
                return "-";
            }

            return <DisplayDate date={completedAt} className="ml-3" />
        },
    },
    {
        id: "duration",
        header: () => <SharedLabel id="colDuration" />,
        cell: ({ row }) => {
            const job = row.original
            return getDuration(job.createdAt, job.completedAt)
        },
    },
    {
        accessorKey: "id",
        header: () => <SharedLabel id="colJobId" />,
        cell: ({ row }) => {
            const id = row.getValue("id") as string
            return (
                <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground">{id}</code>
                    <CopyIconButton onCopy={() => {
                        navigator.clipboard.writeText(id);
                        return true;
                    }} />
                </div>
            )
        },
    },
]

export const RepoJobsTable = ({
    data,
    repoId,
    isIndexButtonVisible,
}: {
    data: RepoIndexingJob[],
    repoId: number,
    isIndexButtonVisible: boolean,
}) => {
    const t = useTranslations('repos');
    const tConn = useTranslations('connections');
    const tCommon = useTranslations('common');
    const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const router = useRouter();
    const { toast } = useToast();

    const [isIndexSubmitting, setIsIndexSubmitting] = React.useState(false);
    const onIndexButtonClick = React.useCallback(async () => {
        setIsIndexSubmitting(true);
        const response = await indexRepo(repoId);

        if (!isServiceError(response)) {
            const { jobId } = response;
            toast({
                description: t('syncTriggered', { jobId }),
            })
            router.refresh();
        } else {
            toast({
                description: t('indexFailed', { reason: response.message }),
            });
        }

        setIsIndexSubmitting(false);
    }, [repoId, router, toast, t]);

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
    })

    const {
        numCompleted,
        numInProgress,
        numPending,
        numFailed,
    } = useMemo(() => {
        return {
            numCompleted: data.filter((job) => job.status === "COMPLETED").length,
            numInProgress: data.filter((job) => job.status === "IN_PROGRESS").length,
            numPending: data.filter((job) => job.status === "PENDING").length,
            numFailed: data.filter((job) => job.status === "FAILED").length,
        };
    }, [data]);

    return (
        <div className="w-full">
            <div className="flex items-center gap-4 py-4">
                <Select
                    value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                    onValueChange={(value) => table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={tConn('filterByStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{tConn('filterByStatus')}</SelectItem>
                        <SelectItem value="COMPLETED">{tConn('filterCompleted', { count: numCompleted })}</SelectItem>
                        <SelectItem value="IN_PROGRESS">{tConn('filterInProgress', { count: numInProgress })}</SelectItem>
                        <SelectItem value="PENDING">{tConn('filterPending', { count: numPending })}</SelectItem>
                        <SelectItem value="FAILED">{tConn('filterFailed', { count: numFailed })}</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={(table.getColumn("type")?.getFilterValue() as string) ?? "all"}
                    onValueChange={(value) => table.getColumn("type")?.setFilterValue(value === "all" ? "" : value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('filterByType')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t('allTypes')}</SelectItem>
                        <SelectItem value="INDEX">{t('typeIndex')}</SelectItem>
                        <SelectItem value="CLEANUP">{t('typeCleanup')}</SelectItem>
                    </SelectContent>
                </Select>

                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            router.refresh();
                            toast({
                                description: tCommon('pageRefreshed'),
                            });
                        }}
                    >
                        <RefreshCwIcon className="w-3 h-3" />
                        {tConn('refresh')}
                    </Button>

                    {isIndexButtonVisible && (
                        <LoadingButton
                            onClick={onIndexButtonClick}
                            loading={isIndexSubmitting}
                            variant="outline"
                        >
                            <PlusCircleIcon className="w-3 h-3" />
                            {t('triggerSync')}
                        </LoadingButton>
                    )}
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {t('noJobs')}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {tCommon('jobsTotal', { count: table.getFilteredRowModel().rows.length })}
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        {tConn('previous')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        {tConn('next')}
                    </Button>
                </div>
            </div>
        </div>
    )
}

type RepoLabelKey = 'colRepository' | 'colRevision' | 'colType' | 'colSyncedCommit' | 'firstIndex' | 'revisionNotIndexed';
type ConnectionLabelKey = 'colStatus' | 'colLatestStatus' | 'colLastSynced' | 'colStarted' | 'colCompleted' | 'colDuration' | 'colJobId';

/** Text rendered from column definitions, translated to the current locale. */
const Label = ({ id }: { id: RepoLabelKey }) => {
    const t = useTranslations('repos');
    return <>{t(id)}</>;
}

const SharedLabel = ({ id }: { id: ConnectionLabelKey }) => {
    const t = useTranslations('connections');
    return <>{t(id)}</>;
}

const StatusLabel = ({ status }: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' }) => {
    const t = useTranslations('connections');
    return <>{t(`status.${status}`)}</>;
}
