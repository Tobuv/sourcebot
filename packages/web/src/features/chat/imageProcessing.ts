'use client';

import { formatBytes } from "./attachments";
import {
    defaultImageAttachmentErrorMessages,
    getScaledDimensions,
    ImageAttachment,
    ImageAttachmentErrorMessages,
    MAX_IMAGE_BYTES,
    SUPPORTED_IMAGE_MEDIA_TYPES,
    SupportedImageMediaType,
} from "./imageAttachments";

/** Images already within limits and smaller than this are attached as-is. */
const PASSTHROUGH_MAX_BYTES = 512 * 1024;
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

const blobToBase64 = async (blob: Blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const getFileName = (file: File, mediaType: string) => {
    if (file.name) {
        return file.name;
    }
    // Pasted screenshots usually have no name.
    return `pasted-image.${mediaType.split('/')[1]}`;
}

/**
 * Prepares an image file for attachment: images that are small enough are kept as-is,
 * others are downscaled (longest side <= MAX_IMAGE_DIMENSION) and re-encoded
 * (PNG sources stay PNG when small enough, everything else becomes JPEG).
 */
export const processImageFile = async (
    file: File,
    messages: ImageAttachmentErrorMessages = defaultImageAttachmentErrorMessages,
): Promise<ImageAttachment | { error: string }> => {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        return { error: messages.unreadable(file.name || 'Image') };
    }

    try {
        const { width, height } = getScaledDimensions(bitmap.width, bitmap.height);
        const isSupportedType = (SUPPORTED_IMAGE_MEDIA_TYPES as readonly string[]).includes(file.type);
        const needsResize = width !== bitmap.width || height !== bitmap.height;

        if (isSupportedType && !needsResize && file.size <= PASSTHROUGH_MAX_BYTES) {
            return {
                name: getFileName(file, file.type),
                mediaType: file.type as SupportedImageMediaType,
                data: await blobToBase64(file),
                width,
                height,
            };
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
            return { error: messages.browserCannotProcess() };
        }

        // Screenshots and diagrams are usually PNG; keep PNG when it stays small enough
        // since it preserves text sharpness and transparency.
        context.drawImage(bitmap, 0, 0, width, height);
        if (file.type === 'image/png') {
            const png = await canvasToBlob(canvas, 'image/png');
            if (png && png.size <= MAX_IMAGE_BYTES) {
                return { name: getFileName(file, 'image/png'), mediaType: 'image/png', data: await blobToBase64(png), width, height };
            }
        }

        // JPEG has no alpha channel: paint a white background first.
        context.globalCompositeOperation = 'destination-over';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);

        for (const quality of JPEG_QUALITIES) {
            const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
            if (jpeg && jpeg.size <= MAX_IMAGE_BYTES) {
                const name = getFileName(file, 'image/jpeg').replace(/\.(png|webp|gif|bmp|tiff?|heic|avif)$/i, '.jpg');
                return { name, mediaType: 'image/jpeg', data: await blobToBase64(jpeg), width, height };
            }
        }

        return { error: messages.tooLargeAfterCompression(file.name || 'Image', formatBytes(MAX_IMAGE_BYTES)) };
    } finally {
        bitmap.close();
    }
}
