'use client';

import type { ImageAttachment } from "./imageAttachments";

/**
 * In-memory handoff of image attachments for the first message of a new chat.
 *
 * The first message is passed to the chat page through sessionStorage, whose ~5MB
 * quota base64 images could exceed (and writes fail silently). Navigation to the chat
 * page is client-side, so a module-level variable survives it.
 */
let pending: { chatId: string, images: ImageAttachment[] } | undefined;

export const setPendingChatImages = (chatId: string, images: ImageAttachment[]) => {
    pending = images.length > 0 ? { chatId, images } : undefined;
}

/** Returns (and clears) the pending images for the given chat. */
export const takePendingChatImages = (chatId: string): ImageAttachment[] => {
    if (!pending || pending.chatId !== chatId) {
        return [];
    }
    const { images } = pending;
    pending = undefined;
    return images;
}
