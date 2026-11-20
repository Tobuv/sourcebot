import { beforeEach, describe, expect, test, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const mocks = vi.hoisted(() => ({
    signIn: vi.fn(),
    role: 'OWNER' as 'OWNER' | 'MEMBER',
    credentialsEnabled: 'true',
    prisma: {
        user: { findUnique: vi.fn(), update: vi.fn() },
        userToOrg: { findUnique: vi.fn() },
    },
}));

vi.mock('@/auth', () => ({ signIn: mocks.signIn }));
vi.mock('@/middleware/sew', () => ({ sew: (fn: () => unknown) => fn() }));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: (fn: (ctx: unknown) => unknown) => fn({
        org: { id: 1 },
        user: { id: 'me' },
        role: mocks.role,
        prisma: mocks.prisma,
    }),
}));
vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
    env: new Proxy({}, { get: (_, key) => key === 'AUTH_CREDENTIALS_LOGIN_ENABLED' ? mocks.credentialsEnabled : undefined }),
}));
vi.mock('@sourcebot/db', () => ({ OrgRole: { OWNER: 'OWNER', MEMBER: 'MEMBER', GUEST: 'GUEST' } }));

const { changePassword, resetMemberPassword } = await import('./passwordActions');
const { changePasswordInputSchema } = await import('./passwordUtils');

const isError = (value: unknown): value is { message: string } => typeof value === 'object' && value !== null && 'errorCode' in value;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.role = 'OWNER';
    mocks.credentialsEnabled = 'true';
    mocks.prisma.user.findUnique.mockResolvedValue({ email: 'me@example.com', hashedPassword: bcrypt.hashSync('old-password', 4) });
});

describe('changePasswordInputSchema', () => {
    test('enforces length and difference', () => {
        expect(changePasswordInputSchema.safeParse({ currentPassword: 'old-password', newPassword: 'short' }).success).toBe(false);
        expect(changePasswordInputSchema.safeParse({ currentPassword: 'same-password', newPassword: 'same-password' }).success).toBe(false);
        expect(changePasswordInputSchema.safeParse({ currentPassword: 'x', newPassword: 'a'.repeat(73) }).success).toBe(false);
        expect(changePasswordInputSchema.safeParse({ currentPassword: 'old-password', newPassword: 'new-password' }).success).toBe(true);
    });
});

describe('changePassword', () => {
    test('updates the hash, invalidates sessions and re-issues the current session', async () => {
        const result = await changePassword({ currentPassword: 'old-password', newPassword: 'new-password' });
        expect(result).toEqual({ success: true });

        const { data } = mocks.prisma.user.update.mock.calls[0][0];
        expect(bcrypt.compareSync('new-password', data.hashedPassword)).toBe(true);
        expect(data.sessionVersion).toEqual({ increment: 1 });
        expect(mocks.signIn).toHaveBeenCalledWith('credentials', { email: 'me@example.com', password: 'new-password', redirect: false });
    });

    test('rejects a wrong current password', async () => {
        const result = await changePassword({ currentPassword: 'wrong-password', newPassword: 'new-password' });
        expect(isError(result) && result.message).toMatch(/current password is incorrect/);
        expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    });

    test('rejects accounts without a password', async () => {
        mocks.prisma.user.findUnique.mockResolvedValue({ email: 'me@example.com', hashedPassword: null });
        const result = await changePassword({ currentPassword: 'old-password', newPassword: 'new-password' });
        expect(isError(result)).toBe(true);
        expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    });

    test('is unavailable when credentials login is disabled', async () => {
        mocks.credentialsEnabled = 'false';
        expect(isError(await changePassword({ currentPassword: 'old-password', newPassword: 'new-password' }))).toBe(true);
    });

    test('still succeeds if re-issuing the session fails', async () => {
        mocks.signIn.mockRejectedValueOnce(new Error('boom'));
        expect(await changePassword({ currentPassword: 'old-password', newPassword: 'new-password' })).toEqual({ success: true });
    });
});

describe('resetMemberPassword', () => {
    beforeEach(() => {
        mocks.prisma.userToOrg.findUnique.mockResolvedValue({ user: { hashedPassword: 'hash' } });
    });

    test('sets a random temporary password and signs the member out', async () => {
        const result = await resetMemberPassword('member');
        expect(isError(result)).toBe(false);
        const { temporaryPassword } = result as { temporaryPassword: string };
        expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);

        const { where, data } = mocks.prisma.user.update.mock.calls[0][0];
        expect(where).toEqual({ id: 'member' });
        expect(bcrypt.compareSync(temporaryPassword, data.hashedPassword)).toBe(true);
        expect(data.sessionVersion).toEqual({ increment: 1 });
    });

    test('is restricted to owners', async () => {
        mocks.role = 'MEMBER';
        expect(isError(await resetMemberPassword('member'))).toBe(true);
        expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    });

    test('rejects resetting your own password', async () => {
        expect(isError(await resetMemberPassword('me'))).toBe(true);
    });

    test('rejects users outside the org and SSO-only users', async () => {
        mocks.prisma.userToOrg.findUnique.mockResolvedValueOnce(null);
        expect(isError(await resetMemberPassword('stranger'))).toBe(true);

        mocks.prisma.userToOrg.findUnique.mockResolvedValueOnce({ user: { hashedPassword: null } });
        expect(isError(await resetMemberPassword('sso-user'))).toBe(true);
        expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    });
});
