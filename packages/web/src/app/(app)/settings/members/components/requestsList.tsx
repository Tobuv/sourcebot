'use client';

import { OrgRole } from "@sourcebot/db";
import { useToast } from "@/components/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isServiceError } from "@/lib/utils";
import { UserAvatar } from "@/components/userAvatar";
import { CheckCircle, Search, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { approveAccountRequest, rejectAccountRequest } from "@/actions";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Request {
    id: string;
    email: string;
    createdAt: Date;
    name?: string;
    image?: string;
}

interface RequestsListProps {
    requests: Request[]
    currentUserRole: OrgRole
}

export const RequestsList = ({ requests, currentUserRole }: RequestsListProps) => {
    const t = useTranslations('members');
    const [searchQuery, setSearchQuery] = useState("")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [isApproveRequestDialogOpen, setIsApproveRequestDialogOpen] = useState(false)
    const [isRejectRequestDialogOpen, setIsRejectRequestDialogOpen] = useState(false)
    const [requestToAction, setRequestToAction] = useState<Request | null>(null)
    const { toast } = useToast();
    const router = useRouter();

    const filteredRequests = useMemo(() => {
        return requests
            .filter((request) => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch =
                    request.email.toLowerCase().includes(searchLower) ||
                    (request.name?.toLowerCase().includes(searchLower) || false);
                return matchesSearch;
            })
            .sort((a, b) => {
                return dateSort === "newest"
                    ? b.createdAt.getTime() - a.createdAt.getTime()
                    : a.createdAt.getTime() - b.createdAt.getTime()
            });
    }, [requests, searchQuery, dateSort]);

    const onApproveRequest = useCallback((requestId: string) => {
        approveAccountRequest(requestId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('approveFailed', { reason: response.message })
                    })
                } else {
                    toast({
                        description: t('approved')
                    })
                    router.refresh();
                }
            });
    }, [toast, router, t]);

    const onRejectRequest = useCallback((requestId: string) => {
        rejectAccountRequest(requestId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('rejectFailed')
                    })
                } else {
                    toast({
                        description: t('rejected')
                    })
                    router.refresh();
                }
            });
    }, [toast, router, t]);

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
                    {requests.length === 0 || (filteredRequests.length === 0 && searchQuery.length > 0) ? (
                        <div className="flex flex-col items-center justify-center h-96 p-4">
                            <p className="font-medium text-sm">{t('noRequests')}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                {filteredRequests.length === 0 && searchQuery.length > 0 ? t('noRequestsFiltered') : t('noRequestsHint')}
                            </p>
                        </div>
                    ) : (
                        filteredRequests.map((request) => (
                            <div key={request.id} className="p-4 flex items-center justify-between bg-background">
                                <div className="flex items-center gap-3">
                                    <UserAvatar email={request.email} imageUrl={request.image} />
                                    <div>
                                        <div className="font-medium">{request.name || request.email}</div>
                                        <div className="text-sm text-muted-foreground">{request.email}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {currentUserRole === OrgRole.OWNER && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => {
                                                    setRequestToAction(request);
                                                    setIsApproveRequestDialogOpen(true);
                                                }}
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                                {t('approve')}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    setRequestToAction(request);
                                                    setIsRejectRequestDialogOpen(true);
                                                }}
                                            >
                                                <XCircle className="h-4 w-4" />
                                                {t('reject')}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Approve Request Dialog */}
            <AlertDialog
                open={isApproveRequestDialogOpen}
                onOpenChange={setIsApproveRequestDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('approveTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t.rich('approveConfirm', { email: requestToAction?.email ?? '', b: (chunks) => <strong>{chunks}</strong> })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t('back')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => {
                                onApproveRequest(requestToAction?.id ?? "");
                            }}
                        >
                            {t('approve')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Request Dialog */}
            <AlertDialog
                open={isRejectRequestDialogOpen}
                onOpenChange={setIsRejectRequestDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('rejectTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t.rich('rejectConfirm', { email: requestToAction?.email ?? '', b: (chunks) => <strong>{chunks}</strong> })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t('back')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                onRejectRequest(requestToAction?.id ?? "");
                            }}
                        >
                            {t('reject')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
} 