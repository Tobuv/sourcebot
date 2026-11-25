import { MembersList } from "./components/membersList";
import { getOrgMembers } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { InviteMemberCard } from "./components/inviteMemberCard";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabSwitcher } from "@/components/ui/tab-switcher";
import { InvitesList } from "./components/invitesList";
import { getOrgInvites, getMe, getOrgAccountRequests } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { getSeats, hasEntitlement, SOURCEBOT_UNLIMITED_SEATS } from "@sourcebot/shared";
import { RequestsList } from "./components/requestsList";
import { OrgRole } from "@sourcebot/db";
import { NotificationDot } from "../../components/notificationDot";
import { Badge } from "@/components/ui/badge";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getTranslations } from "next-intl/server";

type MembersSettingsPageProps = {
    searchParams: Promise<{
        tab?: string
    }>
}

export default authenticatedPage<MembersSettingsPageProps>(async ({ org, role }, props) => {
    const t = await getTranslations('settings.members');
    const searchParams = await props.searchParams;

    const {
        tab
    } = searchParams;

    const me = await getMe();
    if (isServiceError(me)) {
        throw new ServiceErrorException(me);
    }

    const members = await getOrgMembers();
    if (isServiceError(members)) {
        throw new ServiceErrorException(members);
    }

    const invites = await getOrgInvites();
    if (isServiceError(invites)) {
        throw new ServiceErrorException(invites);
    }

    const requests = await getOrgAccountRequests();
    if (isServiceError(requests)) {
        throw new ServiceErrorException(requests);
    }

    const currentTab = tab || "members";

    const seats = getSeats();
    const usedSeats = members.length
    const seatsAvailable = seats === SOURCEBOT_UNLIMITED_SEATS || usedSeats < seats;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-medium">{t('title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('description')}</p>
                </div>
                {seats && seats !== SOURCEBOT_UNLIMITED_SEATS && (
                    <div className="bg-card px-4 py-2 rounded-md border shadow-sm">
                        <div className="text-sm">
                            <span className="text-muted-foreground">
                                {t.rich('seatsUsed', { used: usedSeats, total: seats, b: (chunks) => <span className="text-foreground font-medium">{chunks}</span> })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <InviteMemberCard
                currentUserRole={role}
                seatsAvailable={seatsAvailable}
            />

            <Tabs value={currentTab}>
                <div className="border-b border-border w-full">
                    <TabSwitcher
                        className="h-auto p-0 bg-transparent"
                        tabs={[
                            {
                                label: (
                                    <div className="flex items-center gap-2">
                                        {t('teamMembers')}
                                        <Badge variant="secondary" className="px-1.5 relative">
                                            {members.length}
                                        </Badge>
                                    </div>
                                ),
                                value: "members"
                            },
                            ...(role === OrgRole.OWNER ? [
                                {
                                    label: (
                                        <div className="flex items-center gap-2">
                                            {requests.length > 0 && (
                                                <NotificationDot />
                                            )}
                                            {t('pendingRequests')}
                                            {requests.length > 0 && (
                                                <Badge variant="secondary" className="px-1.5 relative">
                                                    {requests.length}
                                                </Badge>
                                            )}
                                        </div>
                                    ),
                                    value: "requests"
                                },
                                {
                                    label: (
                                        <div className="flex items-center gap-2">
                                            {t('pendingInvites')}
                                            {invites.length > 0 && (
                                                <Badge variant="secondary" className="px-1.5 relative">
                                                    {invites.length}
                                                </Badge>
                                            )}
                                        </div>
                                    ),
                                    value: "invites"
                                },
                            ] : []),
                        ]}
                        currentTab={currentTab}
                    />
                </div>
                <TabsContent value="members">
                    <MembersList
                        members={members}
                        currentUserId={me.id}
                        currentUserRole={role}
                        orgName={org.name}
                        hasOrgManagement={hasEntitlement('org-management')}
                    />
                </TabsContent>

                {role === OrgRole.OWNER && (
                    <>
                        <TabsContent value="requests">
                            <RequestsList
                                requests={requests}
                                currentUserRole={role}
                            />
                        </TabsContent>

                        <TabsContent value="invites">
                            <InvitesList
                                invites={invites}
                                currentUserRole={role}
                            />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    )
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
