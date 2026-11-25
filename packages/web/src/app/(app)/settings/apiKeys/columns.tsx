"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Key, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteApiKey } from "@/actions"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { useToast } from "@/components/hooks/use-toast"
import { useLocale, useTranslations } from "next-intl";
import { getIntlLocale } from "@/i18n/dateLocale";

export type ApiKeyColumnInfo = {
    name: string
    createdAt: string
    lastUsedAt: string | null
}

// Component for the actions cell to properly use React hooks
function ApiKeyActions({ apiKey }: { apiKey: ApiKeyColumnInfo }) {
    const t = useTranslations('apiKeys');
    const tCommon = useTranslations('common');
    const [isPending, setIsPending] = useState(false)
    const { toast } = useToast()
    
    const handleDelete = async () => {
        setIsPending(true)
        try {
            await deleteApiKey(apiKey.name)
            window.location.reload()
        } catch (error) {
            console.error("Failed to delete API key", error)
            toast({
                title: t('deleteFailedTitle'),
                description: t('deleteFailed', { reason: String(error) }),
                variant: "destructive",
            })
        } finally {
            setIsPending(false)
        }
    }
    
    return (
        <div className="flex justify-end">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t.rich('deleteConfirm', { name: apiKey.name, b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span> })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            disabled={isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isPending ? t('deleting') : tCommon('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export const columns = (): ColumnDef<ApiKeyColumnInfo>[] => [
    {
        accessorKey: "name",
        header: () => <div className="flex items-center w-[300px]"><ColumnLabel id="colName" /></div>,
        cell: ({ row }) => {
            const name = row.original.name
            return (
                <div className="flex items-center gap-2 py-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{name}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <div className="w-[200px]">
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="px-0 font-medium"
                >
                    <ColumnLabel id="colCreated" />
                    <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            if (!row.original.createdAt) {
                return <div className="py-2">—</div>
            }
            const date = new Date(row.original.createdAt)
            return (
                <div className="py-2 text-muted-foreground">
                    <LocalizedDate date={date} />
                </div>
            )
        },
    },
    {
        accessorKey: "lastUsedAt",
        header: ({ column }) => (
            <div className="w-[200px]">
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="px-0 font-medium"
                >
                    <ColumnLabel id="colLastUsed" />
                    <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            if (!row.original.lastUsedAt) {
                return <div className="py-2 text-muted-foreground"><ColumnLabel id="never" /></div>
            }
            const date = new Date(row.original.lastUsedAt)
            return (
                <div className="py-2 text-muted-foreground">
                    <LocalizedDate date={date} />
                </div>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <ApiKeyActions apiKey={row.original} />
    }
] 
/** Column header / empty state text, translated to the current locale. */
const ColumnLabel = ({ id }: { id: 'colName' | 'colCreated' | 'colLastUsed' | 'never' }) => {
    const t = useTranslations('apiKeys');
    return <>{t(id)}</>;
}

const LocalizedDate = ({ date }: { date: Date }) => {
    const locale = useLocale();
    return <>{date.toLocaleDateString(getIntlLocale(locale), { month: "short", day: "numeric", year: "numeric" })}</>;
}
