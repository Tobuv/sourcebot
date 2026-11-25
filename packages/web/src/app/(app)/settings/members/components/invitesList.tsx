'use client';

import { OrgRole } from "@sourcebot/db";
import { useToast } from "@/components/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPathWithQueryParams, isServiceError } from "@/lib/utils";
import { UserAvatar } from "@/components/userAvatar";
import { Copy, MoreVertical, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { cancelInvite } from "@/actions";
import { useRouter } from "next/navigation";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useTranslations } from "next-intl";
interface Invite {
    id: string;
    email: string;
    createdAt: Date;
}

interface InviteListProps {
    invites: Invite[]
    currentUserRole: OrgRole
}

export const InvitesList = ({ invites, currentUserRole }: InviteListProps) => {
    const t = useTranslations('members');
    const [searchQuery, setSearchQuery] = useState("")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [isCancelInviteDialogOpen, setIsCancelInviteDialogOpen] = useState(false)
    const [inviteToCancel, setInviteToCancel] = useState<Invite | null>(null)
    const { toast } = useToast();
    const router = useRouter();
    const captureEvent = useCaptureEvent();

    const filteredInvites = useMemo(() => {
        return invites
            .filter((invite) => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch =
                    invite.email.toLowerCase().includes(searchLower);
                return matchesSearch;
            })
            .sort((a, b) => {
                return dateSort === "newest"
                    ? b.createdAt.getTime() - a.createdAt.getTime()
                    : a.createdAt.getTime() - b.createdAt.getTime()
            });
    }, [invites, searchQuery, dateSort]);

    const onCancelInvite = useCallback((inviteId: string) => {
        cancelInvite(inviteId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('cancelInviteFailed', { reason: response.message })
                    })
                    captureEvent('wa_invites_list_cancel_invite_fail', {
                        errorCode: response.errorCode,
                    })
                } else {
                    toast({
                        description: t('inviteCancelled')
                    })
                    captureEvent('wa_invites_list_cancel_invite_success', {})
                    router.refresh();
                }
            });
    }, [toast, router, captureEvent, t]);

    return (
        <div className="w-full mx-auto space-y-6">
            <div className="flex gap-4 flex-col sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('filterPlaceholder')}
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Select value={dateSort} onValueChange={(value) => setDateSort(value as "newest" | "oldest")}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">{t('newest')}</SelectItem>
                        <SelectItem value="oldest">{t('oldest')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto divide-y">
                    {invites.length === 0 || (filteredInvites.length === 0 && searchQuery.length > 0) ? (
                        <div className="flex flex-col items-center justify-center h-96 p-4">
                            <p className="font-medium text-sm">{t('noInvites')}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                {filteredInvites.length === 0 && searchQuery.length > 0 ? t('noInvitesFiltered') : t('noInvitesHint')}
                            </p>
                        </div>
                    ) : (
                        filteredInvites.map((invite) => (
                            <div key={invite.id} className="p-4 flex items-center justify-between bg-background">
                                <div className="flex items-center gap-3">
                                    <UserAvatar email={invite.email} />
                                    <div>
                                        <div className="text-sm text-muted-foreground">{invite.email}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2"
                                        title={t('copyInviteLink')}
                                        onClick={() => {
                                            const url = createPathWithQueryParams(`${window.location.origin}/redeem?invite_id=${invite.id}`);
                                            navigator.clipboard.writeText(url)
                                                .then(() => {
                                                    toast({
                                                        description: t('inviteLinkCopied', { email: invite.email })
                                                    })
                                                    captureEvent('wa_invites_list_copy_invite_link_success', {})
                                                })
                                                .catch(() => {
                                                    toast({
                                                        description: t('inviteLinkCopyFailed')
                                                    })
                                                    captureEvent('wa_invites_list_copy_invite_link_fail', {})
                                                })
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                        {t('copyInviteLink')}
                                    </Button>
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(invite.email)
                                                        .then(() => {
                                                            toast({
                                                                description: t('emailCopied')
                                                            })
                                                            captureEvent('wa_invites_list_copy_email_success', {})
                                                        })
                                                        .catch(() => {
                                                            toast({
                                                                description: t('emailCopyFailed')
                                                            })
                                                            captureEvent('wa_invites_list_copy_email_fail', {})
                                                        })
                                                }}
                                            >
                                                {t('copyEmail')}
                                            </DropdownMenuItem>
                                            {currentUserRole === OrgRole.OWNER && (
                                                <DropdownMenuItem
                                                    className="cursor-pointer text-destructive"
                                                    onClick={() => {
                                                        setIsCancelInviteDialogOpen(true);
                                                        setInviteToCancel(invite);
                                                    }}
                                                >
                                                    {t('cancelInvite')}
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <AlertDialog
                open={isCancelInviteDialogOpen}
                onOpenChange={setIsCancelInviteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('cancelInviteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t.rich('cancelInviteConfirm', { email: inviteToCancel?.email ?? '', b: (chunks) => <strong>{chunks}</strong> })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t('back')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                onCancelInvite(inviteToCancel?.id ?? "");
                            }}
                        >
                            {t('cancelInvite')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}