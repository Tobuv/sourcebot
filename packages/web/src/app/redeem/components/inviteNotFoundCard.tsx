import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { UserAvatar } from "@/components/userAvatar";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";


export const InviteNotFoundCard = async () => {
    const t = await getTranslations('redeem');
    const session = await auth();

    return (
        <Card className="flex flex-col items-center justify-center max-w-md text-center p-12">
            <SourcebotLogo
                className="h-16 w-auto mx-auto mb-2"
                size="large"
            />
            <h2 className="text-2xl font-bold">{t('notFound')}</h2>
            <p className="mt-5">
                {t('notFoundDescription')}
            </p>
            <div className="flex flex-col items-center gap-2 mt-8">
                <UserAvatar
                    email={session?.user.email}
                    imageUrl={session?.user.image}
                    className="h-12 w-12"
                />
                <p className="text-sm text-muted-foreground">
                    Logged in as <strong>{session?.user?.email}</strong>
                </p>
            </div>
        </Card>
    );
}