'use client';

import { useEffect, useState } from 'react';
import { UNPERMITTED_SCHEMES } from '@/ee/features/oauth/constants';
import { useTranslations } from "next-intl";

// Handles the final redirect after OAuth authorization. For http/https redirect URIs,
// a server-side redirect is sufficient. For custom protocol URIs (e.g. cursor://, claude://),
// browsers won't follow HTTP redirects, so we use window.location.href instead.
export default function OAuthCompletePage() {
    const t = useTranslations('oauth');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const raw = new URLSearchParams(window.location.search).get('url');
        if (!raw) {
            setError(t('missingRedirect'));
            return;
        }
        const decoded = decodeURIComponent(raw);
        if (UNPERMITTED_SCHEMES.test(decoded)) {
            setError(t('redirectNotPermittedClose'));
            return;
        }
        window.location.href = decoded;
    }, [t]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">
                {error ?? t('redirecting')}
            </p>
        </div>
    );
}
