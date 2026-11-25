'use client';

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { IdentityProviderMetadata } from "@/lib/identityProviders";

interface LoginFormProps {
    callbackUrl?: string;
    error?: string;
    providers: IdentityProviderMetadata[];
    context: "login" | "signup";
    isAnonymousAccessEnabled?: boolean;
    hideSecurityNotice?: boolean;
}

export const LoginForm = ({ callbackUrl, error, providers, context, isAnonymousAccessEnabled = false, hideSecurityNotice = false }: LoginFormProps) => {
    const t = useTranslations('login');

    const safeCallbackUrl = useMemo(() => {
        if (!callbackUrl) return "/";
        // Allow only relative paths that start with "/" but not "//" (protocol-relative URLs)
        if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
            return callbackUrl;
        }
        return "/";
    }, [callbackUrl]);

    const errorMessage = useMemo(() => {
        if (!error) {
            return "";
        }
        switch (error) {
            case "CredentialsSignin":
                return t('errorCredentials');
            case "OAuthAccountNotLinked":
                return t('errorAccountNotLinked');
            default:
                return t('errorGeneric');
        }
    }, [error, t]);

    return (
        <div className="flex flex-col items-center justify-center w-full">
            <div className="mb-6 flex flex-col items-center">
                <SourcebotLogo
                    className="h-12 sm:h-16 mb-3"
                />
                <h2 className="text-lg font-medium text-center">
                    {context === "login" ? t('signInTitle') : t('signUpTitle')}
                </h2>
            </div>
            <Card className="flex flex-col items-center border p-6 sm:p-12 rounded-lg gap-4 sm:gap-6 w-full sm:w-[500px] max-w-[500px] bg-background">
                {error && (
                    <div className="text-sm text-destructive text-center text-wrap border p-2 rounded-md border-destructive">
                        {errorMessage}
                    </div>
                )}
                <AuthMethodSelector
                    providers={providers}
                    callbackUrl={callbackUrl}
                    context={context}
                    securityNoticeClosable={true}
                    hideSecurityNotice={hideSecurityNotice}
                />
                <p className="text-sm text-muted-foreground mt-8">
                    {context === "login" ?
                        t.rich('noAccount', {
                            link: (chunks) => <Link className="underline" href={callbackUrl ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signup"}>{chunks}</Link>,
                        })
                    :
                        t.rich('haveAccount', {
                            link: (chunks) => <Link className="underline" href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}>{chunks}</Link>,
                        })
                    }
                </p>
                {isAnonymousAccessEnabled && (
                    <p className="text-sm text-muted-foreground">
                        <Link className="underline" href={safeCallbackUrl}>{t('continueAsGuest')}</Link>
                    </p>
                )}
            </Card>
        </div>
    )
}
