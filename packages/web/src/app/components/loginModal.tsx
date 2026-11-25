'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import type { IdentityProviderMetadata } from "@/lib/identityProviders";
import { useTranslations } from "next-intl";

interface LoginModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    providers: IdentityProviderMetadata[];
    callbackUrl: string;
}

export const LoginModal = ({
    isOpen,
    onOpenChange,
    providers,
    callbackUrl,
}: LoginModalProps) => {
    const t = useTranslations('orgAccess');
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="mb-3">{t('signUpToContinue')}</DialogTitle>
                    <DialogDescription>
                        {t('signInToContinue')}
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <AuthMethodSelector
                        providers={providers}
                        callbackUrl={callbackUrl}
                        context="login"
                        hideSecurityNotice={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};
