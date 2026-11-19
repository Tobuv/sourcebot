import { z } from "zod";

/**
 * Text attachments for Ask Sourcebot.
 *
 * Users can attach text-based files (logs, configs, stack traces, code that is not
 * indexed, ...) to a chat message. Attachments are stored inline on the user
 * message as `data-attachment` parts and are sent to the model as part of that
 * message's content.
 *
 * This module is shared between the client and the server.
 */

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_ATTACHMENT_BYTES = 256 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 1024 * 1024;

/** Pastes larger than this are converted into an attachment instead of being inserted into the editor. */
export const PASTE_TO_ATTACHMENT_MIN_CHARS = 4000;
export const PASTE_TO_ATTACHMENT_MIN_LINES = 80;

export const textAttachmentSchema = z.object({
    name: z.string().min(1).max(255),
    mediaType: z.string().max(255),
    content: z.string(),
    /** Size of the content in bytes (UTF-8). */
    size: z.number().int().nonnegative(),
});
export type TextAttachment = z.infer<typeof textAttachmentSchema>;

const getByteLength = (text: string) => new TextEncoder().encode(text).length;

export const formatBytes = (bytes: number) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates a set of attachments against the per-message limits.
 * Returns an error message, or `undefined` if the attachments are valid.
 */
export const validateAttachments = (attachments: TextAttachment[]): string | undefined => {
    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        return `A message can have at most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments.`;
    }

    let total = 0;
    for (const attachment of attachments) {
        const size = getByteLength(attachment.content);
        if (size > MAX_ATTACHMENT_BYTES) {
            return `"${attachment.name}" is larger than the ${formatBytes(MAX_ATTACHMENT_BYTES)} limit.`;
        }
        total += size;
    }

    if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
        return `Attachments exceed the ${formatBytes(MAX_TOTAL_ATTACHMENT_BYTES)} total limit per message.`;
    }

    return undefined;
}

/**
 * Returns true if the bytes look like text: no NUL bytes and valid UTF-8.
 */
export const isProbablyText = (bytes: Uint8Array) => {
    const sample = bytes.subarray(0, 8192);
    if (sample.includes(0)) {
        return false;
    }

    try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return true;
    } catch {
        return false;
    }
}

export const readFileAsTextAttachment = async (file: File): Promise<TextAttachment | { error: string }> => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
        return { error: `"${file.name}" is larger than the ${formatBytes(MAX_ATTACHMENT_BYTES)} limit.` };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isProbablyText(bytes)) {
        return { error: `"${file.name}" is not a text file. Only text files can be attached.` };
    }

    const content = new TextDecoder('utf-8').decode(bytes);
    return {
        name: file.name,
        mediaType: file.type || 'text/plain',
        content,
        size: bytes.length,
    };
}

export const shouldConvertPasteToAttachment = (text: string) => {
    if (text.length >= PASTE_TO_ATTACHMENT_MIN_CHARS) {
        return true;
    }
    return text.split('\n').length >= PASTE_TO_ATTACHMENT_MIN_LINES;
}

export const createPastedTextAttachment = (text: string, existingAttachments: TextAttachment[]): TextAttachment => {
    const existingNames = new Set(existingAttachments.map((attachment) => attachment.name));
    let index = 1;
    while (existingNames.has(`pasted-text-${index}.txt`)) {
        index++;
    }

    return {
        name: `pasted-text-${index}.txt`,
        mediaType: 'text/plain',
        content: text,
        size: getByteLength(text),
    };
}

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Formats attachments for inclusion in the model prompt.
 */
export const formatAttachmentsForPrompt = (attachments: TextAttachment[]) => {
    if (attachments.length === 0) {
        return '';
    }

    const body = attachments
        .map((attachment) => `<attachment name="${escapeAttribute(attachment.name)}" media_type="${escapeAttribute(attachment.mediaType)}">\n${attachment.content}\n</attachment>`)
        .join('\n\n');

    return `<attachments>\nThe user attached the following files to this message. They are not part of the indexed repositories, so do not cite them with file references; refer to them by name instead.\n\n${body}\n</attachments>`;
}
