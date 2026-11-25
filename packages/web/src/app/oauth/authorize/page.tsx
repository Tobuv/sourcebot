import { auth } from '@/auth';
import { LogoutEscapeHatch } from '@/app/components/logoutEscapeHatch';
import { ConsentScreen } from './components/consentScreen';
import { __unsafePrisma } from '@/prisma';
import { hasEntitlement } from '@sourcebot/shared';
import { redirect } from 'next/navigation';
import { getTranslations } from "next-intl/server";

export const dynamic = 'force-dynamic';

interface AuthorizePageProps {
    searchParams: Promise<{
        client_id?: string;
        redirect_uri?: string;
        code_challenge?: string;
        code_challenge_method?: string;
        response_type?: string;
        state?: string;
        resource?: string | string[];
    }>;
}

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
    const t = await getTranslations('oauth');
    if (!hasEntitlement('oauth')) {
        return <ErrorPage message={t('notAvailable')} />;
    }

    const params = await searchParams;
    const { client_id, redirect_uri, code_challenge, code_challenge_method, response_type, state, resource: _resource } = params;

    // RFC 8707 allows multiple resource parameters to indicate a token intended for multiple resources.
    // Sourcebot only supports a single resource (the MCP endpoint), so we take the first value.
    //
    // @see: https://www.rfc-editor.org/rfc/rfc8707.html#section-2-2.2
    const resource = Array.isArray(_resource) ? _resource[0] : _resource;

    // Validate required parameters. Per spec, do NOT redirect on client errors —
    // show an error page instead to avoid open redirect vulnerabilities.
    if (!client_id || !redirect_uri || !code_challenge || !response_type) {
        return <ErrorPage message={t('missingParams')} />;
    }

    if (response_type !== 'code') {
        return <ErrorPage message={t('unsupportedResponseType', { value: String(response_type) })} />;
    }

    if (code_challenge_method && code_challenge_method !== 'S256') {
        return <ErrorPage message={t('unsupportedChallenge', { value: String(code_challenge_method) })} />;
    }

    const client = await __unsafePrisma.oAuthClient.findUnique({ where: { id: client_id } });

    if (!client) {
        return <ErrorPage message={t('unknownClient')} />;
    }

    if (!client.redirectUris.includes(redirect_uri)) {
        return <ErrorPage message={t('redirectMismatch')} />;
    }

    // If the user is not logged in, redirect to login with this page as the callback.
    const session = await auth();
    if (!session) {
        const callbackUrl = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`;
        redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <ConsentScreen
                clientId={client_id!}
                clientName={client.name}
                clientLogoUri={client.logoUri}
                redirectUri={redirect_uri!}
                codeChallenge={code_challenge!}
                resource={resource ?? null}
                state={state}
                userEmail={session!.user.email!}
            />
        </div>
    );
}

async function ErrorPage({ message }: { message: string }) {
    const t = await getTranslations('oauth');
    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm text-center">
                <h1 className="text-xl font-semibold text-foreground mb-2">{t('errorTitle')}</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}
