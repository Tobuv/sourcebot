import { OrganizationAccessSettings } from "@/app/components/organizationAccessSettings";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { getTranslations } from "next-intl/server";

export default authenticatedPage(async () => {
    const t = await getTranslations('settings');
    const tCommon = await getTranslations('common');
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">{t('access.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('access.description')}{" "}
                    <a
                        href="https://docs.sourcebot.dev/docs/configuration/auth/access-settings"
                        target="_blank"
                        rel="noopener"
                        className="underline text-primary hover:text-primary/80 transition-colors"
                    >
                        {tCommon('learnMore')}
                    </a>
                </p>
            </div>

            <OrganizationAccessSettings />
        </div>
    )
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings',
});
