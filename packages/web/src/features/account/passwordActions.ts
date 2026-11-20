'use server';

import { signIn } from "@/auth";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { OrgRole } from "@sourcebot/db";
import { createLogger, env } from "@sourcebot/shared";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { StatusCodes } from "http-status-codes";
import { changePasswordInputSchema, ChangePasswordInput } from "./passwordUtils";

const logger = createLogger('account-password');

const badRequest = (message: string): ServiceError => ({
    statusCode: StatusCodes.BAD_REQUEST,
    errorCode: ErrorCode.INVALID_REQUEST_BODY,
    message,
});

const credentialsLoginDisabled = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "Email and password login is disabled.",
});

/**
 * Changes the current user's password.
 *
 * All of the user's sessions (and other devices) are signed out by bumping their
 * `sessionVersion`; the current session is then re-issued by signing in again with
 * the new password, so the user stays signed in here.
 */
export const changePassword = async (input: ChangePasswordInput): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ user, prisma }) => {
        if (env.AUTH_CREDENTIALS_LOGIN_ENABLED !== 'true') {
            return credentialsLoginDisabled();
        }

        const parsed = changePasswordInputSchema.safeParse(input);
        if (!parsed.success) {
            return requestBodySchemaValidationError(parsed.error);
        }
        const { currentPassword, newPassword } = parsed.data;

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { email: true, hashedPassword: true },
        });

        if (!dbUser?.hashedPassword || !dbUser.email) {
            return badRequest("Your account does not use a password. Sign in with your identity provider instead.");
        }

        if (!bcrypt.compareSync(currentPassword, dbUser.hashedPassword)) {
            return badRequest("The current password is incorrect.");
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                hashedPassword: bcrypt.hashSync(newPassword, 10),
                // Invalidate every existing session, including this one...
                sessionVersion: { increment: 1 },
            },
        });

        // ...then issue a fresh session cookie for this browser.
        try {
            await signIn('credentials', { email: dbUser.email, password: newPassword, redirect: false });
        } catch (error) {
            // The password was changed; the user just has to sign in again.
            logger.warn('Failed to re-issue the session after a password change', error);
        }

        return { success: true };
    })
);

const generateTemporaryPassword = () => randomBytes(12).toString('base64url');

/**
 * Resets the password of a member of the org to a random temporary password and
 * signs them out everywhere. Owners only. The temporary password is returned once
 * so the owner can pass it on.
 */
export const resetMemberPassword = async (memberId: string): Promise<{ temporaryPassword: string } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        if (env.AUTH_CREDENTIALS_LOGIN_ENABLED !== 'true') {
            return credentialsLoginDisabled();
        }

        if (role !== OrgRole.OWNER) {
            return {
                statusCode: StatusCodes.FORBIDDEN,
                errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                message: "Only owners can reset passwords.",
            } satisfies ServiceError;
        }

        if (memberId === user.id) {
            return badRequest("Use Settings → Account to change your own password.");
        }

        const membership = await prisma.userToOrg.findUnique({
            where: { orgId_userId: { orgId: org.id, userId: memberId } },
            include: { user: { select: { hashedPassword: true } } },
        });

        if (!membership) {
            return notFound();
        }

        if (!membership.user.hashedPassword) {
            return badRequest("This member signs in with an identity provider and has no password.");
        }

        const temporaryPassword = generateTemporaryPassword();
        await prisma.user.update({
            where: { id: memberId },
            data: {
                hashedPassword: bcrypt.hashSync(temporaryPassword, 10),
                sessionVersion: { increment: 1 },
            },
        });

        logger.info(`Owner ${user.id} reset the password of member ${memberId}.`);
        return { temporaryPassword };
    })
);
