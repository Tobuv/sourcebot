import { getLicenseKey, getEntitlements, getPlan, SOURCEBOT_UNLIMITED_SEATS } from "@sourcebot/shared";
import { Button } from "@/components/ui/button";
import { Info, Mail } from "lucide-react";
import { getOrgMembers } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { getTranslations, getLocale } from "next-intl/server";
import { getIntlLocale } from "@/i18n/dateLocale";

export default authenticatedPage(async () => {
    const t = await getTranslations('settings.license');
    const locale = await getLocale();
    const licenseKey = getLicenseKey();
    const entitlements = getEntitlements();
    const plan = getPlan();

    if (!licenseKey) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h3 className="text-lg font-medium">{t('title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('description')}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-8 border rounded-md bg-card">
                    <Info className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">{t('notFound')}</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                        {t.rich('notFoundDescription', { link: (chunks) => <a href="https://docs.sourcebot.dev/docs/license-key" target="_blank" rel="noopener noreferrer" className="text-primary">{chunks}</a> })}
                    </p>
                    <div className="mb-8 max-w-md rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                        <p className="text-base text-center">
                            {t('trialPitch')}
                        </p>
                    </div>
                    <Button asChild>
                        <a href={`https://sourcebot.dev/contact`} target="_blank" rel="noopener noreferrer">
                            <Mail className="h-4 w-4 mr-2" />
                            {t('requestTrial')}
                        </a>
                    </Button>
                </div>
            </div>
        )
    }

    const members = await getOrgMembers();
    if (isServiceError(members)) {
        throw new ServiceErrorException(members);
    }

    const numMembers = members.length;
    const expiryDate = new Date(licenseKey.expiryDate);
    const isExpired = expiryDate < new Date();
    const seats = licenseKey.seats;
    const isUnlimited = seats === SOURCEBOT_UNLIMITED_SEATS;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-medium">{t('title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('description')}</p>
                </div>

                <Button asChild>
                    <a href={`mailto:team@sourcebot.dev?subject=License Support - ${licenseKey.id}&body=License ID: ${licenseKey.id}`}>
                        <Mail className="h-4 w-4 mr-2" />
                        {t('contactSupport')}
                    </a>
                </Button>
            </div>

            <div className="grid gap-6">
                <div className="border rounded-md p-6 bg-card">
                    <h4 className="text-base font-medium mb-4">{t('details')}</h4>

                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">{t('id')}</div>
                            <div className="text-sm font-mono">{licenseKey.id}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">{t('plan')}</div>
                            <div className="text-sm font-mono">{plan}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">{t('entitlements')}</div>
                            <div className="text-sm font-mono">{entitlements?.join(", ") || t('none')}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">{t('seats')}</div>
                            <div className="text-sm font-mono">
                                {isUnlimited ? t('unlimited') : `${numMembers} / ${seats}`}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">{t('expiryDate')}</div>
                            <div className={`text-sm font-mono ${isExpired ? 'text-destructive' : ''}`}>
                                {expiryDate.toLocaleString(getIntlLocale(locale), {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                    timeZoneName: "short"
                                })} {isExpired && t('expired')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
