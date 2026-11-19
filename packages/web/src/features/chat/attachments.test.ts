// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
    createPastedTextAttachment,
    formatAttachmentsForPrompt,
    formatBytes,
    isProbablyText,
    MAX_ATTACHMENT_BYTES,
    MAX_ATTACHMENTS_PER_MESSAGE,
    PASTE_TO_ATTACHMENT_MIN_CHARS,
    PASTE_TO_ATTACHMENT_MIN_LINES,
    readFileAsTextAttachment,
    shouldConvertPasteToAttachment,
    TextAttachment,
    validateAttachments,
} from './attachments';

const attachment = (name: string, content: string): TextAttachment => ({
    name,
    mediaType: 'text/plain',
    content,
    size: new TextEncoder().encode(content).length,
});

describe('validateAttachments', () => {
    test('accepts attachments within limits', () => {
        expect(validateAttachments([attachment('a.txt', 'hello')])).toBeUndefined();
        expect(validateAttachments([])).toBeUndefined();
    });

    test('rejects too many attachments', () => {
        const many = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, (_, i) => attachment(`${i}.txt`, 'x'));
        expect(validateAttachments(many)).toMatch(/at most/);
    });

    test('rejects a single attachment over the size limit', () => {
        expect(validateAttachments([attachment('big.txt', 'x'.repeat(MAX_ATTACHMENT_BYTES + 1))])).toMatch(/big\.txt/);
    });

    test('rejects attachments over the total limit', () => {
        const chunk = 'x'.repeat(MAX_ATTACHMENT_BYTES);
        expect(validateAttachments([1, 2, 3, 4, 5].map((i) => attachment(`${i}.txt`, chunk)))).toMatch(/total limit/);
    });

    test('measures size from the content, not the declared size', () => {
        const lying = { ...attachment('a.txt', 'x'.repeat(MAX_ATTACHMENT_BYTES + 1)), size: 1 };
        expect(validateAttachments([lying])).toBeDefined();
    });
});

describe('isProbablyText', () => {
    test('accepts UTF-8 text', () => {
        expect(isProbablyText(new TextEncoder().encode('hello 世界\n'))).toBe(true);
    });

    test('rejects binary content', () => {
        expect(isProbablyText(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))).toBe(false);
        expect(isProbablyText(new Uint8Array([0xff, 0xfe, 0xfd]))).toBe(false);
    });
});

describe('readFileAsTextAttachment', () => {
    test('reads a text file', async () => {
        const result = await readFileAsTextAttachment(new File(['log line\n'], 'app.log', { type: '' }));
        expect(result).toEqual({ name: 'app.log', mediaType: 'text/plain', content: 'log line\n', size: 9 });
    });

    test('rejects binary files', async () => {
        const result = await readFileAsTextAttachment(new File([new Uint8Array([0, 1, 2])], 'a.bin'));
        expect(result).toHaveProperty('error');
    });

    test('rejects files over the size limit', async () => {
        const result = await readFileAsTextAttachment(new File(['x'.repeat(MAX_ATTACHMENT_BYTES + 1)], 'big.txt'));
        expect(result).toHaveProperty('error');
    });
});

describe('paste handling', () => {
    test('converts long or many-line pastes', () => {
        expect(shouldConvertPasteToAttachment('short')).toBe(false);
        expect(shouldConvertPasteToAttachment('x'.repeat(PASTE_TO_ATTACHMENT_MIN_CHARS))).toBe(true);
        expect(shouldConvertPasteToAttachment('a\n'.repeat(PASTE_TO_ATTACHMENT_MIN_LINES))).toBe(true);
    });

    test('generates unique pasted attachment names', () => {
        const first = createPastedTextAttachment('a', []);
        expect(first.name).toBe('pasted-text-1.txt');
        expect(createPastedTextAttachment('b', [first]).name).toBe('pasted-text-2.txt');
    });
});

describe('formatAttachmentsForPrompt', () => {
    test('returns an empty string for no attachments', () => {
        expect(formatAttachmentsForPrompt([])).toBe('');
    });

    test('wraps attachments and escapes attribute values', () => {
        const prompt = formatAttachmentsForPrompt([attachment('we"ird<.txt', 'content')]);
        expect(prompt).toContain('<attachment name="we&quot;ird&lt;.txt" media_type="text/plain">\ncontent\n</attachment>');
        expect(prompt.startsWith('<attachments>')).toBe(true);
    });
});

test('formatBytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
});
