import { getVisibleSkills, toSkillInfo } from "@/features/chat/skills/skills.server";
import { SkillInfo } from "@/features/chat/skills/skillUtils";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withOptionalAuth } from "@/middleware/withAuth";

export type ListSkillsResponse = SkillInfo[];

/**
 * Lists the Ask skills visible to the current user (their personal skills and
 * the org's workspace skills). Internal API, not part of the public API.
 */
export const GET = apiHandler(async () => {
    const result = await sew(() =>
        withOptionalAuth(async ({ org, user, role, prisma }) => {
            const skills = await getVisibleSkills({ prisma, orgId: org.id, userId: user?.id, includeShadowed: true });
            return skills.map((skill) => toSkillInfo(skill, user?.id, role, skill.isShadowed)) satisfies ListSkillsResponse;
        })
    );

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
