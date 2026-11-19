'use server';

import { ErrorCode } from "@/lib/errorCodes";
import { notFound, requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { OrgRole } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { canEditSkill, isSkillNameTaken, toSkillInfo } from "./skills.server";
import { SkillInfo, SkillInput, skillInputSchema } from "./skillUtils";

const forbidden = (message: string): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message,
});

const nameTaken = (name: string, scope: SkillInput['scope']): ServiceError => ({
    statusCode: StatusCodes.CONFLICT,
    errorCode: ErrorCode.INVALID_REQUEST_BODY,
    message: scope === 'WORKSPACE'
        ? `A workspace skill named "${name}" already exists.`
        : `You already have a skill named "${name}".`,
});

const WORKSPACE_OWNER_ONLY = "Only workspace owners can manage workspace skills.";

export const createSkill = async (input: SkillInput): Promise<SkillInfo | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const parsed = skillInputSchema.safeParse(input);
        if (!parsed.success) {
            return requestBodySchemaValidationError(parsed.error);
        }
        const data = parsed.data;

        if (data.scope === 'WORKSPACE' && role !== OrgRole.OWNER) {
            return forbidden(WORKSPACE_OWNER_ONLY);
        }

        if (await isSkillNameTaken({ prisma, orgId: org.id, userId: user.id, scope: data.scope, name: data.name })) {
            return nameTaken(data.name, data.scope);
        }

        const skill = await prisma.chatSkill.create({
            data: {
                ...data,
                orgId: org.id,
                createdById: user.id,
            },
            include: { createdBy: { select: { name: true, email: true } } },
        });

        return toSkillInfo(skill, user.id, role);
    })
);

export const updateSkill = async (id: string, input: SkillInput): Promise<SkillInfo | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const parsed = skillInputSchema.safeParse(input);
        if (!parsed.success) {
            return requestBodySchemaValidationError(parsed.error);
        }
        const data = parsed.data;

        const existing = await prisma.chatSkill.findFirst({
            where: { id, orgId: org.id },
        });

        // Don't reveal other users' personal skills.
        if (!existing || (existing.scope === 'PERSONAL' && existing.createdById !== user.id)) {
            return notFound();
        }

        if (!canEditSkill(existing, user.id, role)) {
            return forbidden(WORKSPACE_OWNER_ONLY);
        }

        // Moving a skill into the workspace scope requires owner permissions. Moving a
        // workspace skill into a personal scope makes it owned by the current user.
        if (data.scope === 'WORKSPACE' && role !== OrgRole.OWNER) {
            return forbidden(WORKSPACE_OWNER_ONLY);
        }

        if (await isSkillNameTaken({ prisma, orgId: org.id, userId: user.id, scope: data.scope, name: data.name, excludeId: id })) {
            return nameTaken(data.name, data.scope);
        }

        const skill = await prisma.chatSkill.update({
            where: { id },
            data: {
                ...data,
                ...(data.scope === 'PERSONAL' && existing.scope !== 'PERSONAL' ? { createdById: user.id } : {}),
            },
            include: { createdBy: { select: { name: true, email: true } } },
        });

        return toSkillInfo(skill, user.id, role);
    })
);

export const deleteSkill = async (id: string): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const existing = await prisma.chatSkill.findFirst({
            where: { id, orgId: org.id },
        });

        if (!existing || (existing.scope === 'PERSONAL' && existing.createdById !== user.id)) {
            return notFound();
        }

        if (!canEditSkill(existing, user.id, role)) {
            return forbidden(WORKSPACE_OWNER_ONLY);
        }

        await prisma.chatSkill.delete({ where: { id } });
        return { success: true };
    })
);
