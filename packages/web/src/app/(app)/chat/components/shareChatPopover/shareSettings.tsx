'use client';

import { SessionUser } from "@/auth";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/userAvatar";
import { ChatVisibility } from "@sourcebot/db";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Link2Icon, Loader2, Lock, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

interface ShareSettingsProps {
    visibility: ChatVisibility;
    onVisibilityChange: (visibility: ChatVisibility) => Promise<boolean>;
    onRemoveSharedWithUser: (userId: string) => Promise<boolean>;
    onOpenInviteView: () => void;
    currentUser?: SessionUser;
    sharedWithUsers: SessionUser[];
    isChatSharingEnabledInCurrentPlan: boolean;
    isChatSharingEnabled: boolean;
}

export const ShareSettings = ({
    visibility,
    onVisibilityChange,
    onRemoveSharedWithUser,
    onOpenInviteView,
    currentUser,
    sharedWithUsers,
    isChatSharingEnabledInCurrentPlan,
    isChatSharingEnabled,
}: ShareSettingsProps) => {
    const t = useTranslations('chatShare');
    const [isVisibilityUpdating, setIsVisibilityUpdating] = useState(false);
    const [removingUserIds, setRemovingUserIds] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    const pathname = usePathname();
    const isAuthenticated = !!currentUser;

    const handleCopyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast({
                description: t('linkCopied'),
            });
        } catch (e) {
            toast({
                description: t('copyLinkFailed', { reason: e instanceof Error ? e.message : t('unknownError') }),
                variant: "destructive",
            });
        }
    }, [toast, t]);

    return (
        <div className="flex flex-col py-3 px-4">
            <p className="text-sm font-medium">{t('share')}</p>
            <Separator className="-mx-4 w-auto mt-2 mb-4" />

            {/* Fake Search Bar - Click to open invite view */}
            {(isAuthenticated && isChatSharingEnabled) && (
                <>
                    <span className={cn({ "cursor-not-allowed": !isChatSharingEnabledInCurrentPlan })}>
                        <Button
                            variant="outline"
                            className={cn("w-full justify-start text-muted-foreground font-normal", {
                                "opacity-50 pointer-events-none": !isChatSharingEnabledInCurrentPlan,
                            })}
                            onClick={onOpenInviteView}
                            disabled={!isChatSharingEnabledInCurrentPlan}
                        >
                            {t('searchForUser')}
                        </Button>
                    </span>

                    {/* People with access */}
                    <div className={cn("mt-4", {
                        "opacity-50 cursor-not-allowed": !isChatSharingEnabledInCurrentPlan,
                        "[&_*]:pointer-events-none": !isChatSharingEnabledInCurrentPlan,
                    })}>
                        <label className="text-sm text-muted-foreground mb-2 block">
                            {t('peopleWithAccess')}
                        </label>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto pr-3">
                            {/* Owner (current user) */}
                            {currentUser && (
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            email={currentUser.email}
                                            imageUrl={currentUser.image}
                                            className="h-8 w-8"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {currentUser.name || currentUser.email}
                                                <span className="text-muted-foreground font-normal">{t('you')}</span>
                                            </span>
                                            {currentUser.name && currentUser.email && (
                                                <span className="text-xs text-muted-foreground">{currentUser.email}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Shared users */}
                            {sharedWithUsers.map((user) => (
                                <div key={user.id} className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            email={user.email}
                                            imageUrl={user.image}
                                            className="h-8 w-8"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{user.name || user.email}</span>
                                            {user.name && (
                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                            )}
                                        </div>
                                    </div>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                disabled={removingUserIds.has(user.id)}
                                                onClick={async () => {
                                                    setRemovingUserIds(prev => new Set(prev).add(user.id));
                                                    try {

                                                        await onRemoveSharedWithUser(user.id);
                                                    } finally {
                                                        setRemovingUserIds(prev => {
                                                            const next = new Set(prev);
                                                            next.delete(user.id);
                                                            return next;
                                                        });
                                                    }
                                                }}
                                            >
                                                {removingUserIds.has(user.id) ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <X className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">{t('removeUser')}</TooltipContent>
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    </div>

                    {!isChatSharingEnabledInCurrentPlan && (
                        <p className="text-xs text-muted-foreground mt-2.5">
                            <Info className="h-3 w-3 inline-block mr-1.5 align-middle" />
                            <span className="align-middle">{t.rich('notAvailableOnPlan', { link: (chunks) => <Link href={'https://sourcebot.dev/pricing'} target="_blank" rel="noopener noreferrer" className="underline">{chunks}</Link> })}</span>
                        </p>
                    )}

                    <Separator className="-mx-4 w-auto my-4" />
                </>
            )}

            <label className="text-sm text-muted-foreground mb-3">
                {t('visibility')}
            </label>
            <Select
                value={visibility}
                onValueChange={async (value) => {
                    setIsVisibilityUpdating(true);
                    try {
                        await onVisibilityChange(value as ChatVisibility);
                    } finally {
                        setIsVisibilityUpdating(false);
                    }
                }}
                disabled={isVisibilityUpdating || !isAuthenticated}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ChatVisibility.PRIVATE}>
                        <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            {t('onlyPeopleWithAccess')}
                        </div>
                    </SelectItem>
                    <SelectItem value={ChatVisibility.PUBLIC}>
                        <div className="flex items-center gap-2">
                            <Link2Icon className="h-4 w-4" />
                            {t('anyoneWithLink')}
                        </div>
                    </SelectItem>
                </SelectContent>
            </Select>
            {!isAuthenticated && (
                <p className="text-xs text-muted-foreground mt-2">
                    {t.rich('signInToChangeVisibility', { link: (chunks) => <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`} className="underline">{chunks}</Link> })}
                </p>
            )}
            <Separator className="-mx-4 w-auto my-4" />
            <div className="flex justify-between items-center">
                <Link
                    href="https://docs.sourcebot.dev/docs/features/ask/chat-sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Info className="h-4 w-4" />
                    {t('howSharingWorks')}
                </Link>
                <Button
                    variant="outline"
                    onClick={handleCopyLink}
                    className="gap-2"
                >
                    <Link2Icon className="h-4 w-4" />
                    {t('copyLink')}
                </Button>
            </div>
        </div>
    );
};
