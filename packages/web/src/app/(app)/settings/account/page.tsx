import { authenticatedPage } from "@/middleware/authenticatedPage";
import { env } from "@sourcebot/shared";
import { AccountPage } from "./accountPage";

export default authenticatedPage(async ({ user, prisma }) => {
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true, hashedPassword: true },
    });

    return (
        <AccountPage
            email={dbUser?.email ?? undefined}
            hasPassword={!!dbUser?.hashedPassword}
            isCredentialsLoginEnabled={env.AUTH_CREDENTIALS_LOGIN_ENABLED === 'true'}
        />
    );
});
