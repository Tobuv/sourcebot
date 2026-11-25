'use client';

import { Input } from "@/components/ui/input";
import { Search, MoreVertical } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCallback, useMemo, useState } from "react";
import { OrgRole } from "@prisma/client";
import { UserAvatar } from "@/components/userAvatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { promoteToOwner, demoteToMember } from "@/ee/features/userManagement/actions";
import { leaveOrg, removeMemberFromOrg } from "@/features/userManagement/actions";
import { resetMemberPassword } from "@/features/account/passwordActions";
import { Check, Copy } from "lucide-react";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Member = {
    id: string
    email: string
    name?: string
    role: OrgRole
    joinedAt: Date
    avatarUrl?: string
}

export interface MembersListProps {
    members: Member[],
    currentUserId: string,
    currentUserRole: OrgRole,
    orgName: string,
    hasOrgManagement: boolean,
}

const ROLES_AND_PERMISSIONS_DOCS_LINK = "https://docs.sourcebot.dev/docs/configuration/auth/roles-and-permissions#managing-owners"

export const MembersList = ({ members, currentUserId, currentUserRole, orgName, hasOrgManagement }: MembersListProps) => {
    const t = useTranslations('members');
    const tCommon = useTranslations('common');
    const [searchQuery, setSearchQuery] = useState("")
    const [roleFilter, setRoleFilter] = useState<"all" | OrgRole>("all")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
    const [memberToPromote, setMemberToPromote] = useState<Member | null>(null)
    const [memberToDemote, setMemberToDemote] = useState<Member | null>(null)
    const { toast } = useToast()
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
    const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false)
    const [isDemoteDialogOpen, setIsDemoteDialogOpen] = useState(false)
    const [isLeaveOrgDialogOpen, setIsLeaveOrgDialogOpen] = useState(false)
    const [memberToResetPassword, setMemberToResetPassword] = useState<Member | null>(null)
    const [passwordResetResult, setPasswordResetResult] = useState<{ member: Member, temporaryPassword: string } | null>(null)
    const [isTemporaryPasswordCopied, setIsTemporaryPasswordCopied] = useState(false)
    const router = useRouter();

    const ownerCount = useMemo(() => members.filter(m => m.role === OrgRole.OWNER).length, [members]);

    const filteredMembers = useMemo(() => {
        return members
            .filter((member) => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch =
                    member.name?.toLowerCase().includes(searchLower) || member.email.toLowerCase().includes(searchLower);
                const matchesRole = roleFilter === "all" || member.role === roleFilter;
                return matchesSearch && matchesRole;
            })
            .sort((a, b) => {
                return dateSort === "newest"
                    ? b.joinedAt.getTime() - a.joinedAt.getTime()
                    : a.joinedAt.getTime() - b.joinedAt.getTime()
            });
    }, [members, searchQuery, roleFilter, dateSort]);

    const onRemoveMember = useCallback((memberId: string) => {
        removeMemberFromOrg(memberId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('removeFailed', { reason: response.message })
                    })
                } else {
                    toast({
                        description: t('removed')
                    })
                    router.refresh();
                }
            });
    }, [toast, router, t]);

    const onResetPassword = useCallback((member: Member) => {
        resetMemberPassword(member.id)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('resetFailed', { reason: response.message })
                    })
                } else {
                    setIsTemporaryPasswordCopied(false);
                    setPasswordResetResult({ member, temporaryPassword: response.temporaryPassword });
                }
            });
    }, [toast, t]);

    const onPromoteToOwner = useCallback((memberId: string) => {
        promoteToOwner(memberId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('promoteFailed', { reason: response.message })
                    })
                } else {
                    toast({
                        description: t('promoted')
                    })
                    router.refresh();
                }
            });
    }, [toast, router, t]);

    const onDemoteToMember = useCallback((memberId: string) => {
        demoteToMember(memberId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('demoteFailed', { reason: response.message })
                    })
                } else {
                    toast({
                        description: t('demoted')
                    })
                    router.refresh();
                }
            });
    }, [toast, router, t]);

    const onLeaveOrg = useCallback(() => {
        leaveOrg()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: t('leaveFailed', { reason: response.message })
                    })
                } else {
                    toast({
                        description: t('left')
                    })
                    router.push("/");
                }
            });
    }, [toast, router, t]);

    return (
        <div>
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

                    <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | OrgRole)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('allRoles')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('allRoles')}</SelectItem>
                            <SelectItem value={OrgRole.OWNER}>{t('roles.OWNER')}</SelectItem>
                            <SelectItem value={OrgRole.MEMBER}>{t('roles.MEMBER')}</SelectItem>
                        </SelectContent>
                    </Select>

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
                        {filteredMembers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-96 p-4">
                                <p className="font-medium text-sm">{t('noMembers')}</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {t('noMembersDescription')}
                                </p>
                            </div>
                        ) : (
                            filteredMembers.map((member) => (
                                <div key={member.id} className="p-4 flex items-center justify-between bg-background">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            email={member.email}
                                            imageUrl={member.avatarUrl}
                                        />
                                        <div>
                                            <div className="font-medium">{member.name}</div>
                                            <div className="text-sm text-muted-foreground">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-muted-foreground">{t(`roles.${member.role}`)}</span>
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
                                                        navigator.clipboard.writeText(member.email)
                                                            .then(() => {
                                                                toast({
                                                                    description: t('emailCopied')
                                                                })
                                                            })
                                                            .catch(() => {
                                                                toast({
                                                                    description: t('emailCopyFailed')
                                                                })
                                                            })
                                                    }}
                                                >
                                                    {t('copyEmail')}
                                                </DropdownMenuItem>
                                                {member.id !== currentUserId && currentUserRole === OrgRole.OWNER && member.role !== OrgRole.OWNER && (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer"
                                                                    disabled={!hasOrgManagement}
                                                                    onClick={() => {
                                                                        setMemberToPromote(member);
                                                                        setIsPromoteDialogOpen(true);
                                                                    }}
                                                                >
                                                                    {t('promoteToOwner')}
                                                                </DropdownMenuItem>
                                                            </span>
                                                        </TooltipTrigger>
                                                        {!hasOrgManagement && (
                                                            <TooltipContent
                                                                side="left"
                                                                sideOffset={12}
                                                            >
                                                                {t.rich('upgradeToPromote', { link: (chunks) => <Link href={ROLES_AND_PERMISSIONS_DOCS_LINK} className="text-link hover:underline">{chunks}</Link> })}
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                )}
                                                {currentUserRole === OrgRole.OWNER && member.role === OrgRole.OWNER && (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-destructive"
                                                                    disabled={ownerCount <= 1 || !hasOrgManagement}
                                                                    onClick={() => {
                                                                        setMemberToDemote(member);
                                                                        setIsDemoteDialogOpen(true);
                                                                    }}
                                                                >
                                                                    {t('demoteToMember')}
                                                                </DropdownMenuItem>
                                                            </span>
                                                        </TooltipTrigger>
                                                        {(ownerCount <= 1 || !hasOrgManagement) && (
                                                            <TooltipContent side="left" sideOffset={12}>
                                                                {!hasOrgManagement
                                                                    ? t.rich('upgradeToDemote', { link: (chunks) => <Link href={ROLES_AND_PERMISSIONS_DOCS_LINK} className="text-link hover:underline">{chunks}</Link> })
                                                                    : t('cannotDemoteLastOwner')
                                                                }
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                )}
                                                {member.id !== currentUserId && currentUserRole === OrgRole.OWNER && (
                                                    <DropdownMenuItem
                                                        className="cursor-pointer"
                                                        onClick={() => {
                                                            setMemberToResetPassword(member);
                                                        }}
                                                    >
                                                        {t('resetPassword')}
                                                    </DropdownMenuItem>
                                                )}
                                                {member.id !== currentUserId && currentUserRole === OrgRole.OWNER && (
                                                    <DropdownMenuItem
                                                        className="cursor-pointer text-destructive"
                                                        onClick={() => {
                                                            setMemberToRemove(member);
                                                            setIsRemoveDialogOpen(true);
                                                        }}
                                                    >
                                                        {t('remove')}
                                                    </DropdownMenuItem>
                                                )}
                                                {member.id === currentUserId && (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-destructive"
                                                                    disabled={currentUserRole === OrgRole.OWNER && ownerCount <= 1}
                                                                    onClick={() => {
                                                                        setIsLeaveOrgDialogOpen(true);
                                                                    }}
                                                                >
                                                                    {t('leaveOrganization')}
                                                                </DropdownMenuItem>
                                                            </span>
                                                        </TooltipTrigger>
                                                        {currentUserRole === OrgRole.OWNER && ownerCount <= 1 && (
                                                            <TooltipContent side="left" sideOffset={12}>
                                                                {t('lastOwnerCannotLeave')}
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
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
                    open={isRemoveDialogOpen}
                    onOpenChange={setIsRemoveDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('removeTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('removeConfirm', { name: memberToRemove?.name ?? memberToRemove?.email ?? '' })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                    onRemoveMember(memberToRemove?.id ?? "");
                                }}
                            >
                                {t('remove')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={isPromoteDialogOpen}
                    onOpenChange={setIsPromoteDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('promoteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('promoteConfirm', { name: memberToPromote?.name ?? memberToPromote?.email ?? '' })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    onPromoteToOwner(memberToPromote?.id ?? "");
                                }}
                            >
                                {t('promote')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={isDemoteDialogOpen}
                    onOpenChange={setIsDemoteDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('demoteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {memberToDemote?.id === currentUserId
                                    ? t('demoteSelfConfirm')
                                    : t('demoteConfirm', { name: memberToDemote?.name ?? memberToDemote?.email ?? '' })
                                }
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                    onDemoteToMember(memberToDemote?.id ?? "");
                                }}
                            >
                                {t('demote')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={memberToResetPassword !== null}
                    onOpenChange={(open) => !open && setMemberToResetPassword(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('resetTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('resetConfirm', { name: memberToResetPassword?.name ?? memberToResetPassword?.email ?? '' })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    if (memberToResetPassword) {
                                        onResetPassword(memberToResetPassword);
                                    }
                                    setMemberToResetPassword(null);
                                }}
                            >
                                {t('resetPassword')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={passwordResetResult !== null}
                    onOpenChange={(open) => !open && setPasswordResetResult(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('tempPasswordTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('tempPasswordDescription', { name: passwordResetResult?.member.name ?? passwordResetResult?.member.email ?? '' })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="bg-muted p-2 rounded-md text-sm flex-1 break-all font-mono">
                                {passwordResetResult?.temporaryPassword}
                            </div>
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                    if (passwordResetResult) {
                                        navigator.clipboard.writeText(passwordResetResult.temporaryPassword);
                                        setIsTemporaryPasswordCopied(true);
                                    }
                                }}
                            >
                                {isTemporaryPasswordCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogAction>{t('done')}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={isLeaveOrgDialogOpen}
                    onOpenChange={setIsLeaveOrgDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('leaveTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('leaveConfirm')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={onLeaveOrg}
                            >
                                {t('leave')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
