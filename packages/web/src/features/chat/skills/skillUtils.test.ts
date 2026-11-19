import { describe, expect, test } from 'vitest';
import {
    formatInvokedSkillsForPrompt,
    parseSkillMarkdown,
    serializeSkillMarkdown,
    skillInputSchema,
    toSkillName,
} from './skillUtils';

describe('toSkillName', () => {
    test('slugifies arbitrary names', () => {
        expect(toSkillName('Review PR')).toBe('review-pr');
        expect(toSkillName('  --My_Skill!! v2 ')).toBe('my-skill-v2');
        expect(toSkillName('代码审查')).toBe('');
    });

    test('truncates to 64 characters without a trailing hyphen', () => {
        const name = toSkillName(`${'a'.repeat(63)} b`);
        expect(name.length).toBeLessThanOrEqual(64);
        expect(name.endsWith('-')).toBe(false);
    });
});

describe('skillInputSchema', () => {
    const valid = { name: 'review-pr', description: 'Reviews PRs.', instructions: 'Do it.', scope: 'PERSONAL', autoInvoke: true };

    test('accepts a valid skill', () => {
        expect(skillInputSchema.safeParse(valid).success).toBe(true);
    });

    test('rejects invalid names', () => {
        for (const name of ['Review', 'review_pr', '-review', 'review--pr', '']) {
            expect(skillInputSchema.safeParse({ ...valid, name }).success).toBe(false);
        }
    });

    test('rejects blank description and instructions', () => {
        expect(skillInputSchema.safeParse({ ...valid, description: '   ' }).success).toBe(false);
        expect(skillInputSchema.safeParse({ ...valid, instructions: '' }).success).toBe(false);
    });
});

describe('parseSkillMarkdown', () => {
    test('parses frontmatter and body', () => {
        const markdown = '---\nname: review-pr\ndescription: Review a pull request.\nallowed-tools: Read\n---\n\n# Steps\n\n1. Read the diff\n';
        expect(parseSkillMarkdown(markdown)).toEqual({
            name: 'review-pr',
            description: 'Review a pull request.',
            instructions: '# Steps\n\n1. Read the diff',
        });
    });

    test('supports multi-line YAML descriptions and CRLF line endings', () => {
        const markdown = '---\r\nname: Explain Code\r\ndescription: >\r\n  Explains code.\r\n  Use when asked.\r\n---\r\nBody';
        expect(parseSkillMarkdown(markdown)).toEqual({
            name: 'explain-code',
            description: 'Explains code. Use when asked.',
            instructions: 'Body',
        });
    });

    test('falls back to the provided name', () => {
        const result = parseSkillMarkdown('---\ndescription: d\n---\nbody', 'My Skill');
        expect(result).toMatchObject({ name: 'my-skill' });
    });

    test('reports errors', () => {
        expect(parseSkillMarkdown('no frontmatter')).toHaveProperty('error');
        expect(parseSkillMarkdown('---\nname: x\n---\nbody')).toHaveProperty('error');
        expect(parseSkillMarkdown('---\ndescription: d\n---\nbody')).toHaveProperty('error');
        expect(parseSkillMarkdown('---\n: : bad\n  - yaml\n---\nbody')).toHaveProperty('error');
    });
});

test('serialize then parse round-trips', () => {
    const skill = {
        name: 'review-pr',
        description: 'Review: a "pull request" # with special chars',
        instructions: '## Steps\n\n- one\n- two',
    };
    expect(parseSkillMarkdown(serializeSkillMarkdown(skill))).toEqual(skill);
});

describe('formatInvokedSkillsForPrompt', () => {
    test('returns an empty string for no skills', () => {
        expect(formatInvokedSkillsForPrompt([])).toBe('');
    });

    test('wraps skill instructions', () => {
        const prompt = formatInvokedSkillsForPrompt([{ name: 'review-pr', description: 'd', instructions: 'Do it.' }]);
        expect(prompt).toContain('<skill name="review-pr">\nDo it.\n</skill>');
        expect(prompt.startsWith('<invoked_skills>')).toBe(true);
    });
});
