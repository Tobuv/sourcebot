import { tool } from "ai";
import { z } from "zod";
import type { ToolResult } from "@/features/tools/types";

export const LOAD_SKILL_TOOL_NAME = 'load_skill';

export type LoadableSkill = {
    id: string;
    name: string;
    description: string;
    instructions: string;
};

export type LoadSkillMetadata = {
    name: string;
    found: boolean;
};

/**
 * Creates the `load_skill` tool, which lets the agent load the instructions of
 * an auto-invocable skill when it decides the skill is relevant.
 */
export const createLoadSkillTool = (skills: LoadableSkill[]) => tool({
    title: 'Load skill',
    description: 'Load the full instructions of one of the skills listed in <available_skills>. Call this as soon as a skill is relevant to the user\'s request, before doing the work, then follow the returned instructions.',
    inputSchema: z.object({
        name: z.string().describe('The exact name of the skill to load.'),
    }),
    execute: async ({ name }): Promise<ToolResult<LoadSkillMetadata>> => {
        const skill = skills.find((skill) => skill.name === name);
        if (!skill) {
            return {
                output: `Skill "${name}" not found. Available skills: ${skills.map((skill) => skill.name).join(', ') || '(none)'}.`,
                metadata: { name, found: false },
            };
        }

        return {
            output: `<skill name="${skill.name}">\n${skill.instructions}\n</skill>`,
            metadata: { name, found: true },
        };
    },
    toModelOutput: ({ output }) => ({
        type: "content",
        value: [{ type: "text", text: output.output }],
    }),
});
