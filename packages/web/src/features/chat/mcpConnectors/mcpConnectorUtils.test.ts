import { describe, expect, test } from 'vitest';
import { formatMcpToolResult, MAX_MCP_TOOL_OUTPUT_CHARS, shouldExposeMcpTool, toMcpToolName } from './mcpConnectorUtils';

describe('toMcpToolName', () => {
    test('prefixes the tool with the server name', () => {
        expect(toMcpToolName('jira', 'search_issues', new Set())).toBe('jira__search_issues');
    });

    test('replaces characters that providers do not allow', () => {
        expect(toMcpToolName('my.docs', 'get page/v2', new Set())).toBe('my_docs__get_page_v2');
    });

    test('limits names to 64 characters', () => {
        expect(toMcpToolName('server', 'x'.repeat(100), new Set()).length).toBe(64);
    });

    test('dedupes colliding names', () => {
        const existing = new Set(['a__b_c']);
        expect(toMcpToolName('a', 'b.c', existing)).toBe('a__b_c_2');
        existing.add('a__b_c_2');
        expect(toMcpToolName('a', 'b/c', existing)).toBe('a__b_c_3');

        const long = toMcpToolName('server', 'y'.repeat(100), new Set());
        const deduped = toMcpToolName('server', 'y'.repeat(100), new Set([long]));
        expect(deduped).not.toBe(long);
        expect(deduped.length).toBeLessThanOrEqual(64);
    });
});

describe('shouldExposeMcpTool', () => {
    test('exposes everything by default', () => {
        expect(shouldExposeMcpTool('a', {})).toBe(true);
    });

    test('applies include and exclude lists', () => {
        expect(shouldExposeMcpTool('a', { includeTools: ['a'] })).toBe(true);
        expect(shouldExposeMcpTool('b', { includeTools: ['a'] })).toBe(false);
        expect(shouldExposeMcpTool('a', { excludeTools: ['a'] })).toBe(false);
        expect(shouldExposeMcpTool('a', { includeTools: ['a'], excludeTools: ['a'] })).toBe(false);
        expect(shouldExposeMcpTool('a', { includeTools: [] })).toBe(true);
    });
});

describe('formatMcpToolResult', () => {
    test('joins text, resources and links and omits binary content', () => {
        const result = formatMcpToolResult({
            content: [
                { type: 'text', text: 'hello' },
                { type: 'image', mimeType: 'image/png' },
                { type: 'resource', resource: { uri: 'file:///a.md', text: '# A' } },
                { type: 'resource_link', uri: 'https://x/y', name: 'Y' },
            ],
        });
        expect(result).toEqual({
            output: 'hello\n\n[image content omitted]\n\nResource file:///a.md:\n# A\n\n[Resource link: Y https://x/y]',
            isError: false,
        });
    });

    test('falls back to structured content', () => {
        expect(formatMcpToolResult({ content: [], structuredContent: { a: 1 } }).output).toBe('{\n  "a": 1\n}');
    });

    test('marks errors', () => {
        expect(formatMcpToolResult({ content: [{ type: 'text', text: 'boom' }], isError: true })).toEqual({
            output: 'Tool returned an error:\nboom',
            isError: true,
        });
    });

    test('handles empty results', () => {
        expect(formatMcpToolResult({}).output).toBe('(empty result)');
    });

    test('truncates large outputs', () => {
        const { output } = formatMcpToolResult({ content: [{ type: 'text', text: 'x'.repeat(MAX_MCP_TOOL_OUTPUT_CHARS + 10) }] });
        expect(output).toContain('[Output truncated: 10 more characters]');
        expect(output.length).toBeLessThan(MAX_MCP_TOOL_OUTPUT_CHARS + 100);
    });
});
