'use client';

import { signIn } from "next-auth/react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

interface GcpIapAuthProps {
    callbackUrl?: string;
}

export const GcpIapAuth = ({ callbackUrl }: GcpIapAuthProps) => {
    const t = useTranslations('shared');
    useEffect(() => {
        signIn("gcp-iap", {
            redirectTo: callbackUrl ?? "/"
        }).catch((error) => {
            console.error("Error signing in with GCP IAP:", error);
        });
    }, [callbackUrl]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <p className="text-lg">{t('signingInWithIap')}</p>
            </div>
        </div>
    );
}; 