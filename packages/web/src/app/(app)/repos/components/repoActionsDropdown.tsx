"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getCodeHostInfoForRepo, isServiceError } from "@/lib/utils"
import { ExternalLink, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { indexRepo } from "@/features/workerApi/actions"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/hooks/use-toast"
import type { Repo } from "./reposTable"
import { useTranslations } from "next-intl";

interface RepoActionsDropdownProps {
    repo: Repo
}

export const RepoActionsDropdown = ({ repo }: RepoActionsDropdownProps) => {
    const t = useTranslations('repos');
    const tCommon = useTranslations('common');
    const [isSyncing, setIsSyncing] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const codeHostInfo = getCodeHostInfoForRepo({
        codeHostType: repo.codeHostType,
        name: repo.name,
        displayName: repo.displayName ?? undefined,
        externalWebUrl: repo.webUrl ?? undefined,
    })

    const handleTriggerSync = async () => {
        setIsSyncing(true)
        const response = await indexRepo(repo.id)

        if (!isServiceError(response)) {
            const { jobId } = response
            toast({
                description: t('syncTriggered', { jobId }),
            })
            router.refresh()
        } else {
            toast({
                description: t('syncFailed', { reason: response.message }),
            })
        }

        setIsSyncing(false)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">{t('openMenu')}</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/repos/${repo.id}`}>{t('viewDetails')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleTriggerSync}
                    disabled={isSyncing}
                >
                    {t('triggerSync')}
                </DropdownMenuItem>
                {repo.webUrl && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <a href={repo.webUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                {tCommon('openInCodeHost', { host: codeHostInfo.codeHostName })}
                                <ExternalLink className="ml-2 h-3 w-3" />
                            </a>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
