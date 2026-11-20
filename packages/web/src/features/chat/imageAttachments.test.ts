import { describe, expect, test } from 'vitest';
import {
    describeOmittedImages,
    getBase64ByteLength,
    getScaledDimensions,
    ImageAttachment,
    imageAttachmentSchema,
    MAX_IMAGE_BYTES,
    MAX_IMAGES_PER_MESSAGE,
    toImageDataUrl,
    validateImageAttachments,
} from './imageAttachments';

// Base64 for `n` bytes (without padding when n is a multiple of 3).
const base64OfSize = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');

const image = (name: string, bytes: number): ImageAttachment => ({
    name,
    mediaType: 'image/png',
    data: base64OfSize(bytes),
});

describe('getBase64ByteLength', () => {
    test('accounts for padding', () => {
        for (const size of [0, 1, 2, 3, 4, 5, 100, 1001]) {
            expect(getBase64ByteLength(base64OfSize(size))).toBe(size);
        }
    });
});

describe('imageAttachmentSchema', () => {
    test('accepts supported images', () => {
        expect(imageAttachmentSchema.safeParse(image('a.png', 10)).success).toBe(true);
    });

    test('rejects unsupported media types and non-base64 data', () => {
        expect(imageAttachmentSchema.safeParse({ ...image('a.svg', 10), mediaType: 'image/svg+xml' }).success).toBe(false);
        expect(imageAttachmentSchema.safeParse({ ...image('a.png', 10), data: 'data:image/png;base64,AAAA' }).success).toBe(false);
    });
});

describe('validateImageAttachments', () => {
    test('accepts images within limits', () => {
        expect(validateImageAttachments([image('a.png', 1000)])).toBeUndefined();
    });

    test('rejects too many images', () => {
        const many = Array.from({ length: MAX_IMAGES_PER_MESSAGE + 1 }, (_, i) => image(`${i}.png`, 10));
        expect(validateImageAttachments(many)).toMatch(/at most/);
    });

    test('rejects a single image over the size limit', () => {
        expect(validateImageAttachments([image('big.png', MAX_IMAGE_BYTES + 3)])).toMatch(/big\.png/);
    });

    test('rejects images over the total limit', () => {
        const images = [1, 2, 3].map((i) => image(`${i}.png`, MAX_IMAGE_BYTES - 3));
        expect(validateImageAttachments(images)).toMatch(/total limit/);
    });
});

describe('getScaledDimensions', () => {
    test('keeps small images unchanged', () => {
        expect(getScaledDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    });

    test('scales the longest side down to the limit', () => {
        expect(getScaledDimensions(3136, 1000)).toEqual({ width: 1568, height: 500 });
        expect(getScaledDimensions(1000, 3136)).toEqual({ width: 500, height: 1568 });
    });

    test('never returns zero', () => {
        expect(getScaledDimensions(100000, 1)).toEqual({ width: 1568, height: 1 });
    });
});

test('toImageDataUrl', () => {
    expect(toImageDataUrl({ mediaType: 'image/jpeg', data: 'AAAA' })).toBe('data:image/jpeg;base64,AAAA');
});

test('describeOmittedImages', () => {
    expect(describeOmittedImages([])).toBe('');
    expect(describeOmittedImages([{ name: 'a.png' }])).toContain('an image (a.png)');
    expect(describeOmittedImages([{ name: 'a.png' }, { name: 'b.jpg' }])).toContain('2 images (a.png, b.jpg)');
});
