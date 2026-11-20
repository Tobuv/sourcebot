import { z } from "zod";
import { formatBytes } from "./attachments";

/**
 * Image attachments for Ask Sourcebot.
 *
 * Images are downscaled / re-encoded in the browser before being attached (see
 * `imageProcessing.ts`), stored inline (base64) on the user message as
 * `data-image` parts, and sent to models that accept image input.
 *
 * This module is shared between the client and the server.
 */

export const MAX_IMAGES_PER_MESSAGE = 5;
/** Max size of a single (processed) image. */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
/**
 * Max total size of the images in a message. Kept well below the ~5MB
 * sessionStorage quota used to hand the first message of a new chat to the chat page.
 */
export const MAX_TOTAL_IMAGE_BYTES = 3 * 1024 * 1024;
/** Images are downscaled so that their longest side is at most this many pixels. */
export const MAX_IMAGE_DIMENSION = 1568;

export const SUPPORTED_IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type SupportedImageMediaType = typeof SUPPORTED_IMAGE_MEDIA_TYPES[number];

export const imageAttachmentSchema = z.object({
    name: z.string().min(1).max(255),
    mediaType: z.enum(SUPPORTED_IMAGE_MEDIA_TYPES),
    /** Base64 encoded image data (without a `data:` prefix). */
    data: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Image data must be base64 encoded.'),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
});
export type ImageAttachment = z.infer<typeof imageAttachmentSchema>;

/** Decoded size in bytes of base64 data. */
export const getBase64ByteLength = (base64: string) => {
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor(base64.length * 3 / 4) - padding;
}

export const getImageByteLength = (image: ImageAttachment) => getBase64ByteLength(image.data);

export const toImageDataUrl = (image: Pick<ImageAttachment, 'mediaType' | 'data'>) => `data:${image.mediaType};base64,${image.data}`;

export const isImageFile = (file: File) => file.type.startsWith('image/');

/**
 * Validates a set of images against the per-message limits.
 * Returns an error message, or `undefined` if the images are valid.
 */
export const validateImageAttachments = (images: ImageAttachment[]): string | undefined => {
    if (images.length > MAX_IMAGES_PER_MESSAGE) {
        return `A message can have at most ${MAX_IMAGES_PER_MESSAGE} images.`;
    }

    let total = 0;
    for (const image of images) {
        const size = getImageByteLength(image);
        if (size > MAX_IMAGE_BYTES) {
            return `Image "${image.name}" is larger than the ${formatBytes(MAX_IMAGE_BYTES)} limit.`;
        }
        total += size;
    }

    if (total > MAX_TOTAL_IMAGE_BYTES) {
        return `Images exceed the ${formatBytes(MAX_TOTAL_IMAGE_BYTES)} total limit per message.`;
    }

    return undefined;
}

/**
 * Returns the target size for an image so that its longest side is at most `maxDimension`.
 */
export const getScaledDimensions = (width: number, height: number, maxDimension = MAX_IMAGE_DIMENSION) => {
    const longest = Math.max(width, height);
    if (longest <= maxDimension) {
        return { width, height };
    }
    const scale = maxDimension / longest;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

/**
 * Text used in place of an image when the selected model does not accept images.
 */
export const describeOmittedImages = (images: Pick<ImageAttachment, 'name'>[]) => {
    if (images.length === 0) {
        return '';
    }
    return `[The user attached ${images.length === 1 ? 'an image' : `${images.length} images`} (${images.map((image) => image.name).join(', ')}), but the current model cannot view images.]`;
}
