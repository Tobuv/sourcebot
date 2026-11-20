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

interface AccountPageProps {
    email?: string;
    hasPassword: boolean;
    isCredentialsLoginEnabled: boolean;
}

export const AccountPage = ({ email, hasPassword, isCredentialsLoginEnabled }: AccountPageProps) => {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Account</h3>
                <p className="text-sm text-muted-foreground">
                    {email ? <>Signed in as <span className="font-medium text-foreground">{email}</span>.</> : 'Manage your account.'}
                </p>
            </div>

            <div className="flex flex-col gap-3 rounded-md border p-4 max-w-lg">
                <div>
                    <h4 className="text-sm font-medium">Password</h4>
                    <p className="text-xs text-muted-foreground">
                        Changing your password signs you out on all other devices.
                    </p>
                </div>
                {!isCredentialsLoginEnabled ? (
                    <p className="text-sm text-muted-foreground">Email and password login is disabled on this instance.</p>
                ) : !hasPassword ? (
                    <p className="text-sm text-muted-foreground">Your account signs in with an identity provider and has no password.</p>
                ) : (
                    <ChangePasswordForm />
                )}
            </div>
        </div>
    );
}

const ChangePasswordForm = () => {
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
            fieldErrors.confirmPassword ??= 'The passwords do not match.';
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
        toast({ description: "✅ Password changed. Other devices have been signed out." });
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
            {field('currentPassword', 'Current password', currentPassword, setCurrentPassword, 'current-password')}
            {field('newPassword', 'New password', newPassword, setNewPassword, 'new-password', `At least ${MIN_PASSWORD_LENGTH} characters.`)}
            {field('confirmPassword', 'Confirm new password', confirmPassword, setConfirmPassword, 'new-password')}
            <Button type="submit" disabled={isSaving} className="self-start">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Change password
            </Button>
        </form>
    );
}
