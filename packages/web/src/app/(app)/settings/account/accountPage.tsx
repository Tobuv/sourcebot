'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/features/account/passwordActions";
import { changePasswordInputSchema, MIN_PASSWORD_LENGTH } from "@/features/account/passwordUtils";
import { isServiceError } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

interface AccountPageProps {
    email?: string;
    hasPassword: boolean;
    isCredentialsLoginEnabled: boolean;
}

export const AccountPage = ({ email, hasPassword, isCredentialsLoginEnabled }: AccountPageProps) => {
    const t = useTranslations('settings.account');
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">{t('title')}</h3>
                <p className="text-sm text-muted-foreground">
                    {email ? t.rich('signedInAs', { email, b: (chunks) => <span className="font-medium text-foreground">{chunks}</span> }) : t('manage')}
                </p>
            </div>

            <div className="flex flex-col gap-3 rounded-md border p-4 max-w-lg">
                <div>
                    <h4 className="text-sm font-medium">{t('password')}</h4>
                    <p className="text-xs text-muted-foreground">
                        {t('passwordHint')}
                    </p>
                </div>
                {!isCredentialsLoginEnabled ? (
                    <p className="text-sm text-muted-foreground">{t('credentialsDisabled')}</p>
                ) : !hasPassword ? (
                    <p className="text-sm text-muted-foreground">{t('noPassword')}</p>
                ) : (
                    <ChangePasswordForm />
                )}
            </div>
        </div>
    );
}

const ChangePasswordForm = () => {
    const t = useTranslations('settings.account');
    const { toast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();

        const parsed = changePasswordInputSchema.safeParse({ currentPassword, newPassword });
        const fieldErrors: Record<string, string> = {};
        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                fieldErrors[String(issue.path[0])] ??= issue.message;
            }
        }
        if (confirmPassword !== newPassword) {
            fieldErrors.confirmPassword ??= t('passwordsDoNotMatch');
        }
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length > 0 || !parsed.success) {
            return;
        }

        setIsSaving(true);
        const result = await changePassword(parsed.data);
        setIsSaving(false);

        if (isServiceError(result)) {
            if (result.message.includes('current password')) {
                setErrors({ currentPassword: result.message });
            } else {
                toast({ description: `❌ ${result.message}`, variant: "destructive" });
            }
            return;
        }

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast({ description: t('passwordChanged') });
    };

    const field = (id: string, label: string, value: string, onChange: (value: string) => void, autoComplete: string, hint?: string) => (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="password"
                autoComplete={autoComplete}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            {errors[id]
                ? <p className="text-xs text-destructive">{errors[id]}</p>
                : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
            {field('currentPassword', t('currentPassword'), currentPassword, setCurrentPassword, 'current-password')}
            {field('newPassword', t('newPassword'), newPassword, setNewPassword, 'new-password', t('newPasswordHint', { min: MIN_PASSWORD_LENGTH }))}
            {field('confirmPassword', t('confirmPassword'), confirmPassword, setConfirmPassword, 'new-password')}
            <Button type="submit" disabled={isSaving} className="self-start">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('changePassword')}
            </Button>
        </form>
    );
}
