import { z } from "zod";

/** Same minimum as the credentials login (see verifyCredentialsRequestSchema). */
export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt only uses the first 72 bytes of a password. */
export const MAX_PASSWORD_LENGTH = 72;

export const changePasswordInputSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
        .string()
        .min(MIN_PASSWORD_LENGTH, `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
        .refine(
            (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_LENGTH,
            `The new password must be at most ${MAX_PASSWORD_LENGTH} bytes.`,
        ),
}).refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'The new password must be different from the current password.',
});

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
