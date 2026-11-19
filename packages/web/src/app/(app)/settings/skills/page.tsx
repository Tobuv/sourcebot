import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { SkillsPage } from "./skillsPage";

export default authenticatedPage(async ({ role }) => {
    return <SkillsPage isOwner={role === OrgRole.OWNER} />;
});
