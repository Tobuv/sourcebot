'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { formatBytes } from "../attachments";
import { getImageByteLength, ImageAttachment, toImageDataUrl } from "../imageAttachments";
import { useTranslations } from "next-intl";

interface ImageAttachmentChipProps {
    image: ImageAttachment;
    onRemove?: () => void;
    className?: string;
}

/**
 * Displays an image attachment as a thumbnail. Clicking it opens a larger preview.
 * When `onRemove` is provided, a remove button is shown.
 */
export const ImageAttachmentChip = ({ image, onRemove, className }: ImageAttachmentChipProps) => {
    const t = useTranslations('chatBox');
    const src = toImageDataUrl(image);

    return (
        <div className={cn("group relative h-14 w-14 flex-shrink-0 rounded-md border bg-muted overflow-hidden", className)}>
            <Dialog>
                <DialogTrigger asChild>
                    <button type="button" className="h-full w-full" title={t('previewAttachment', { name: image.name })}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
                        <img src={src} alt={image.name} className="h-full w-full object-cover" />
                    </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="truncate">{image.name}</DialogTitle>
                        <DialogDescription>
                            {image.mediaType}
                            {image.width && image.height ? ` · ${image.width}×${image.height}` : ''}
                            {` · ${formatBytes(getImageByteLength(image))}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-auto min-h-0 flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL */}
                        <img src={src} alt={image.name} className="max-w-full h-auto object-contain" />
                    </div>
                </DialogContent>
            </Dialog>
            {onRemove && (
                <button
                    type="button"
                    className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-background/90 border text-muted-foreground hover:text-foreground"
                    onClick={onRemove}
                    title={t('removeAttachment', { name: image.name })}
                >
                    <XIcon className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
