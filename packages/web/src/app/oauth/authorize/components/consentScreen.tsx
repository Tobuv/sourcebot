'use client';

import { approveAuthorization, denyAuthorization } from '@/ee/features/oauth/actions';
import { isPermittedRedirectUrl } from '@/ee/features/oauth/constants';
import { LoadingButton } from '@/components/ui/loading-button';
import { isServiceError } from '@/lib/utils';
import { ClientIcon } from './clientIcon';
import Image from 'next/image';
import logo from '@/public/logo_512.png';
import { useEffect, useState } from 'react';
import useCaptureEvent from '@/hooks/useCaptureEvent';
import { useToast } from '@/components/hooks/use-toast';
import { useTranslations } from "next-intl";

interface ConsentScreenProps {
    clientId: string;
    clientName: string;
    clientLogoUri: string | null;
    redirectUri: string;
    codeChallenge: string;
    resource: string | null;
    state: string | undefined;
    userEmail: string;
}

export function ConsentScreen({
    clientId,
    clientName,
    clientLogoUri,
    redirectUri,
    codeChallenge,
    resource,
    state,
    userEmail,
}: ConsentScreenProps) {
    const t = useTranslations('oauth');
    const tCommon = useTranslations('common');
    const [pending, setPending] = useState<'approve' | 'deny' | null>(null);
    const captureEvent = useCaptureEvent();
    const { toast } = useToast();

    useEffect(() => {
        captureEvent('wa_oauth_consent_viewed', { clientId, clientName });
    }, [captureEvent, clientId, clientName]);

    const onApprove = async () => {
        captureEvent('wa_oauth_authorization_approved', { clientId, clientName });
        setPending('approve');
        const result = await approveAuthorization({ clientId, redirectUri, codeChallenge, resource, state });
        if (!isServiceError(result)) {
            if (!isPermittedRedirectUrl(result)) {
                toast({ description: t('redirectNotPermitted') });
                setPending(null);
                return;
            }

            toast({
                description: t('approved'),
            });
            window.location.href = result;
        } else {
            toast({
                description: t('approveFailed', { reason: result.message }),
            });
        }
        setPending(null);
    };

    const onDeny = async () => {
        captureEvent('wa_oauth_authorization_denied', { clientId, clientName });
        setPending('deny');
        const result = await denyAuthorization({ redirectUri, state });
        if (isServiceError(result)) {
            setPending(null);
            return;
        }

        if (!isPermittedRedirectUrl(result)) {
            toast({ description: t('redirectNotPermitted') });
            setPending(null);
            return;
        }
        window.location.href = result;
    };

    return (
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">

            {/* App icons */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <ClientIcon name={clientName} logoUri={clientLogoUri} />
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m0 0-3-3m3 3-3 3M16 17H8m0 0 3 3m-3-3 3-3" />
                </svg>
                <Image
                    src={logo}
                    alt="NexusCode"
                    width={70}
                    height={70}
                    className="shrink-0 rounded-xl object-cover"
                />
            </div>

            {/* Title */}
            <h1 className="text-lg font-semibold text-foreground mb-2">
                {t.rich('requesting', { client: clientName, b: (chunks) => <span className="font-bold">{chunks}</span> })}
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-6">
                Logged in as <span className="font-medium">{userEmail}</span>
            </p>

            {/* Details table */}
            <div className="mb-6 text-sm">
                <p className="text-muted-foreground mb-2">{t('details')}</p>
                <div className="rounded-md border border-border divide-y divide-border">
                    <div className="flex px-4 py-2.5">
                        <span className="font-medium text-foreground w-32 shrink-0">{t('nameLabel')}</span>
                        <span>{clientName}</span>
                    </div>
                    <div className="flex px-4 py-2.5">
                        <span className="font-medium text-foreground w-32 shrink-0">{t('redirectUri')}</span>
                        <span className="break-all">{redirectUri}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
                <LoadingButton
                    variant="outline"
                    onClick={onDeny}
                    loading={pending === 'deny'}
                    disabled={pending !== null}
                >
                    {tCommon('cancel')}
                </LoadingButton>
                <LoadingButton
                    onClick={onApprove}
                    loading={pending === 'approve'}
                    disabled={pending !== null}
                >
                    {t('approve')}
                </LoadingButton>
            </div>

        </div>
    );
}
