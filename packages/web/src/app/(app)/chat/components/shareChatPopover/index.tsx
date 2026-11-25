'use client';

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ChatVisibility } from "@sourcebot/db";
import { ShareSettings } from "./shareSettings";
import { useCallback, useState } from "react";
import { shareChatWithUsers, unshareChatWithUser, updateChatVisibility } from "@/features/chat/actions";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";
import { Link2Icon, LockIcon } from "lucide-react";
import { SessionUser } from "@/auth";
import { InvitePanel } from "./ee/invitePanel";
import { captureEvent } from "@/hooks/useCaptureEvent";
import { useTranslations } from "next-intl";

interface ShareChatPopoverProps {
    chatId: string;
    visibility: ChatVisibility;
    currentUser?: SessionUser;
    sharedWithUsers: SessionUser[];
    isChatSharingEnabledInCurrentPlan: boolean;
    isChatSharingEnabled: boolean;
}

type View = 'main' | 'invite';

export const ShareChatPopover = ({
    chatId,
    visibility: _visibility,
    currentUser,
    sharedWithUsers: _sharedWithUsers,
    isChatSharingEnabledInCurrentPlan,
    isChatSharingEnabled,
}: ShareChatPopoverProps) => {
    const t = useTranslations('chatShare');
    const [visibility, setVisibility] = useState(_visibility);
    const [sharedWithUsers, setSharedWithUsers] = useState(_sharedWithUsers);

    const [isOpen, _setIsOpen] = useState(false);
    const { toast } = useToast();
    const [view, setView] = useState<View>('main');

    const onChatVisibilityChange = useCallback(async (newVisibility: ChatVisibility) => {
        const previousVisibility = visibility;
        const response = await updateChatVisibility({ chatId, visibility: newVisibility });
        if (isServiceError(response)) {
            toast({
                description: t('visibilityUpdateFailed', { reason: response.message }),
                variant: "destructive",
            });
            return false;
        } else {
            setVisibility(newVisibility);
            captureEvent('wa_chat_visibility_changed', {
                chatId,
                fromVisibility: previousVisibility,
                toVisibility: newVisibility,
            });
            toast({
                description: t('visibilityUpdated')
            });
            return true;
        }
    }, [chatId, toast, visibility, t]);

    const onUnshareChatWithUser = useCallback(async (userId: string) => {
        const response = await unshareChatWithUser({ chatId, userId });
        if (isServiceError(response)) {
            toast({
                description: t('removeUserFailed', { reason: response.message }),
                variant: "destructive",
            });
            return false;
        } else {
            setSharedWithUsers(prev => prev.filter(u => u.id !== userId));
            captureEvent('wa_chat_user_removed', { chatId });
            toast({
                description: t('accessRemoved')
            });
            return true;
        }
    }, [chatId, toast, t]);


    const onShareChatWithUsers = useCallback(async (users: SessionUser[]) => {
        if (users.length === 0) {
            return false;
        }
        const response = await shareChatWithUsers({ chatId, userIds: users.map(user => user.id) });

        if (isServiceError(response)) {
            toast({
                description: t('shareFailed', { count: users.length }),
                variant: "destructive",
            });
            return false;
        } else {
            setSharedWithUsers(prev => [...prev, ...users]);
            captureEvent('wa_chat_users_invited', {
                chatId,
                numUsersInvited: users.length,
            });
            toast({
                description: t('invited', { count: users.length })
            });
            setView('main');
            return true;
        }
    }, [chatId, toast, t]);

    const onOpenChange = useCallback((open: boolean) => {
        _setIsOpen(open);
        if (open) {
            captureEvent('wa_chat_share_dialog_opened', {
                chatId,
                currentVisibility: visibility,
            });
        }
        // Small delay to ensure the popover close animation completes
        setTimeout(() => {
            if (!open) {
                setView('main');
            }
        }, 100);
    }, [chatId, visibility]);


    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                >
                    {visibility === ChatVisibility.PUBLIC ? (
                        <Link2Icon className="h-4 w-4" />
                    ) : (
                        <LockIcon className="h-4 w-4" />
                    )}
                    {t('share')}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[420px] p-0">
                {view === 'main' ? (
                    <ShareSettings
                        chatId={chatId}
                        visibility={visibility}
                        onVisibilityChange={onChatVisibilityChange}
                        onRemoveSharedWithUser={onUnshareChatWithUser}
                        currentUser={currentUser}
                        sharedWithUsers={sharedWithUsers}
                        onOpenInviteView={() => setView('invite')}
                        isChatSharingEnabledInCurrentPlan={isChatSharingEnabledInCurrentPlan}
                        isChatSharingEnabled={isChatSharingEnabled}
                    />
                ) : (isChatSharingEnabledInCurrentPlan && isChatSharingEnabled)? (
                    <InvitePanel
                        chatId={chatId}
                        onBack={() => setView('main')}
                        onShareChatWithUsers={onShareChatWithUsers}
                    />
                ) : null}
            </PopoverContent>
        </Popover>
    );
};
