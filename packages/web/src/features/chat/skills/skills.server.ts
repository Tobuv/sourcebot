import 'server-only';

import { ChatSkill, OrgRole, PrismaClient } from "@sourcebot/db";
import { SkillInfo } from "./skillUtils";

type ChatSkillWithCreator = ChatSkill & { createdBy: { name: string | null; email: string | null } | null };

export const canEditSkill = (
    skill: Pick<ChatSkill, 'scope' | 'createdById'>,
    userId: string | undefined,
    role: OrgRole,
) => {
    if (!userId) {
        return false;
    }

    if (skill.scope === 'WORKSPACE') {
        return role === OrgRole.OWNER;
    }

    return skill.createdById === userId;
}

export const toSkillInfo = (skill: ChatSkillWithCreator, userId: string | undefined, role: OrgRole, isShadowed = false): SkillInfo => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    scope: skill.scope,
    autoInvoke: skill.autoInvoke,
    canEdit: canEditSkill(skill, userId, role),
    createdByName: skill.createdBy?.name ?? skill.createdBy?.email ?? undefined,
    updatedAt: skill.updatedAt.toISOString(),
    isShadowed,
});

/**
 * Returns the skills visible to a user: their personal skills and the org's
 * workspace skills. Anonymous users only see workspace skills.
 *
 * Personal skills shadow workspace skills with the same name. Shadowed skills are
 * omitted unless `includeShadowed` is set (e.g. for the management page), in which
 * case they are flagged with `isShadowed`.
 */
export const getVisibleSkills = async ({
    prisma,
    orgId,
    userId,
    includeShadowed = false,
}: {
    prisma: PrismaClient;
    orgId: number;
    userId: string | undefined;
    includeShadowed?: boolean;
}): Promise<(ChatSkillWithCreator & { isShadowed: boolean })[]> => {
    const skills = await prisma.chatSkill.findMany({
        where: {
            orgId,
            OR: [
                { scope: 'WORKSPACE' },
                ...(userId ? [{ scope: 'PERSONAL' as const, createdById: userId }] : []),
            ],
        },
        include: {
            createdBy: {
                select: { name: true, email: true },
            },
        },
        orderBy: { name: 'asc' },
    });

    const personalNames = new Set(skills.filter((skill) => skill.scope === 'PERSONAL').map((skill) => skill.name));
    return skills
        .map((skill) => ({ ...skill, isShadowed: skill.scope === 'WORKSPACE' && personalNames.has(skill.name) }))
        .filter((skill) => includeShadowed || !skill.isShadowed);
}

/**
 * Checks whether a skill name is already taken within the given scope
 * (per user for personal skills, per org for workspace skills).
 */
export const isSkillNameTaken = async ({
    prisma,
    orgId,
    userId,
    scope,
    name,
    excludeId,
}: {
    prisma: PrismaClient;
    orgId: number;
    userId: string;
    scope: ChatSkill['scope'];
    name: string;
    excludeId?: string;
}) => {
    const existing = await prisma.chatSkill.findFirst({
        where: {
            orgId,
            name,
            scope,
            ...(scope === 'PERSONAL' ? { createdById: userId } : {}),
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
    });

    return existing !== null;
}
