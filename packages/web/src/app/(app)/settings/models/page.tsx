import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { ModelsPage } from "./modelsPage";

export default authenticatedPage(async ({ role }) => {
    return <ModelsPage isOwner={role === OrgRole.OWNER} />;
});
