import React from "react"
import { Metadata } from "next"
import { SidebarNav } from "./components/sidebar-nav"
import { NavigationMenu } from "../components/navigationMenu"
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { getConnectionStats, getOrgAccountRequests } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@prisma/client";
import { env, hasEntitlement } from "@sourcebot/shared";
import { withAuth } from "@/middleware/withAuth";
import { getTranslations } from "next-intl/server";

interface LayoutProps {
    children: React.ReactNode;
}

export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations('settings');
    return {
        title: t('title'),
    };
}

export default async function SettingsLayout(
    props: LayoutProps
) {
    const t = await getTranslations('settings');
    const {
        children
    } = props;

    const session = await auth();
    if (!session) {
        return redirect('/');
    }

    const sidebarNavItems = await getSidebarNavItems();
    if (isServiceError(sidebarNavItems)) {
        throw new ServiceErrorException(sidebarNavItems);
    }

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu />
            <main className="flex-grow flex justify-center p-4 bg-backgroundSecondary relative">
                <div className="w-full max-w-6xl rounded-lg p-6">
                    <div className="container mx-auto">
                        <div className="mb-16">
                            <h1 className="text-3xl font-semibold">{t('title')}</h1>
                        </div>
                        <div className="flex flex-row gap-10">
                            <aside className="lg:w-48">
                                <SidebarNav items={sidebarNavItems} />
                            </aside>
                            <div className="w-full rounded-lg">{children}</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export const getSidebarNavItems = async () =>
    withAuth(async ({ role }) => {
        const t = await getTranslations('settings');
        let numJoinRequests: number | undefined;
        if (role === OrgRole.OWNER) {
            const requests = await getOrgAccountRequests();
            if (isServiceError(requests)) {
                throw new ServiceErrorException(requests);
            }
            numJoinRequests = requests.length;
        }

        const connectionStats = await getConnectionStats();
        if (isServiceError(connectionStats)) {
            throw new ServiceErrorException(connectionStats);
        }

        return [
            ...(role === OrgRole.OWNER ? [
                {
                    title: t('nav.access'),
                    href: `/settings/access`,
                }
            ] : []),
            ...(role === OrgRole.OWNER ? [{
                title: t('nav.members'),
                isNotificationDotVisible: numJoinRequests !== undefined && numJoinRequests > 0,
                href: `/settings/members`,
            }] : []),
            ...(role === OrgRole.OWNER ? [
                {
                    title: t('nav.connections'),
                    href: `/settings/connections`,
                    hrefRegex: `/settings/connections(/[^/]+)?$`,
                    isNotificationDotVisible: connectionStats.numberOfConnectionsWithFirstTimeSyncJobsInProgress > 0,
                }
            ] : []),
            {
                title: t('nav.account'),
                href: `/settings/account`,
            },
            {
                title: t('nav.models'),
                href: `/settings/models`,
            },
            {
                title: t('nav.skills'),
                href: `/settings/skills`,
            },
            ...(env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'false' || role === OrgRole.OWNER ? [
                {
                    title: t('nav.apiKeys'),
                    href: `/settings/apiKeys`,
                }
            ] : []),
            ...(hasEntitlement("sso") ? [
                {
                    title: t('nav.linkedAccounts'),
                    href: `/settings/linked-accounts`,
                }
            ] : []),
        ]
    });