import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

/**
 * Ask Sourcebot skills: reusable instructions that can be invoked explicitly
 * with `/name` in the chat box, or loaded by the agent when relevant.
 *
 * This module is shared between the client and the server.
 */

export const SKILL_NAME_MAX_LENGTH = 64;
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024;
export const SKILL_INSTRUCTIONS_MAX_LENGTH = 32 * 1024;

export const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const skillScopeSchema = z.enum(['PERSONAL', 'WORKSPACE']);
export type SkillScope = z.infer<typeof skillScopeSchema>;

export const skillNameSchema = z
    .string()
    .min(1, 'Name is required.')
    .max(SKILL_NAME_MAX_LENGTH, `Name must be at most ${SKILL_NAME_MAX_LENGTH} characters.`)
    .regex(SKILL_NAME_REGEX, 'Name may only contain lowercase letters, digits and single hyphens (e.g. "review-pr").');

export const skillInputSchema = z.object({
    name: skillNameSchema,
    description: z
        .string()
        .trim()
        .min(1, 'Description is required.')
        .max(SKILL_DESCRIPTION_MAX_LENGTH, `Description must be at most ${SKILL_DESCRIPTION_MAX_LENGTH} characters.`),
    instructions: z
        .string()
        .trim()
        .min(1, 'Instructions are required.')
        .max(SKILL_INSTRUCTIONS_MAX_LENGTH, `Instructions must be at most ${SKILL_INSTRUCTIONS_MAX_LENGTH / 1024} KB.`),
    scope: skillScopeSchema,
    autoInvoke: z.boolean(),
});
export type SkillInput = z.infer<typeof skillInputSchema>;

/** A skill as returned to the client. */
export type SkillInfo = SkillInput & {
    id: string;
    /** Whether the current user can edit / delete this skill. */
    canEdit: boolean;
    createdByName?: string;
    updatedAt: string;
    /** A workspace skill hidden by a personal skill with the same name. */
    isShadowed: boolean;
};

/** Reference to an explicitly invoked skill, stored on the user message. */
export const skillInvocationSchema = z.object({
    id: z.string(),
    name: z.string(),
});
export type SkillInvocation = z.infer<typeof skillInvocationSchema>;

/**
 * Converts an arbitrary string into a valid skill name, e.g. "Review PR" -> "review-pr".
 */
export const toSkillName = (value: string) => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, SKILL_NAME_MAX_LENGTH)
        .replace(/-+$/g, '');
}

const FRONTMATTER_REGEX = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

export type ParsedSkillMarkdown = {
    name: string;
    description: string;
    instructions: string;
};

/**
 * Parses a SKILL.md file: YAML frontmatter with `name` and `description`,
 * followed by the instructions as markdown. Unknown frontmatter keys are ignored.
 *
 * `fallbackName` (e.g. the file or folder name) is used when the frontmatter has no name.
 */
export const parseSkillMarkdown = (markdown: string, fallbackName?: string): ParsedSkillMarkdown | { error: string } => {
    const match = FRONTMATTER_REGEX.exec(markdown);
    if (!match) {
        return { error: 'Missing YAML frontmatter. A SKILL.md file must start with "---", followed by `name` and `description`, and a closing "---".' };
    }

    let frontmatter: unknown;
    try {
        frontmatter = parseYaml(match[1]);
    } catch (error) {
        return { error: `Invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}` };
    }

    if (typeof frontmatter !== 'object' || frontmatter === null || Array.isArray(frontmatter)) {
        return { error: 'Frontmatter must be a YAML mapping with `name` and `description`.' };
    }

    const { name: rawName, description: rawDescription } = frontmatter as Record<string, unknown>;
    const name = toSkillName(typeof rawName === 'string' && rawName.trim() ? rawName : (fallbackName ?? ''));
    if (!name) {
        return { error: 'Frontmatter is missing `name`.' };
    }

    if (typeof rawDescription !== 'string' || !rawDescription.trim()) {
        return { error: 'Frontmatter is missing `description`.' };
    }

    return {
        name,
        description: rawDescription.trim(),
        instructions: match[2].trim(),
    };
}

/**
 * Serializes a skill into the SKILL.md format.
 */
export const serializeSkillMarkdown = ({ name, description, instructions }: ParsedSkillMarkdown) => {
    const frontmatter = stringifyYaml({ name, description }, { lineWidth: 0 }).trimEnd();
    return `---\n${frontmatter}\n---\n\n${instructions.trim()}\n`;
}

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Formats skills that the user explicitly invoked, for inclusion in their message.
 */
export const formatInvokedSkillsForPrompt = (skills: ParsedSkillMarkdown[]) => {
    if (skills.length === 0) {
        return '';
    }

    const body = skills
        .map((skill) => `<skill name="${escapeAttribute(skill.name)}">\n${skill.instructions}\n</skill>`)
        .join('\n\n');

    return `<invoked_skills>\nThe user invoked the following skills for this message. Follow their instructions when answering.\n\n${body}\n</invoked_skills>`;
}
