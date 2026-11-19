'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FileTextIcon, XIcon } from "lucide-react";
import { formatBytes, TextAttachment } from "../attachments";
import { CodeBlock } from "./chatThread/codeBlock";

interface AttachmentChipProps {
    attachment: TextAttachment;
    onRemove?: () => void;
    className?: string;
}

const getLanguageFromName = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    if (!extension || extension === name.toLowerCase() || extension === 'txt' || extension === 'log') {
        return 'text';
    }
    return extension;
}

/**
 * Displays a text attachment. Clicking it opens a preview of the content.
 * When `onRemove` is provided, a remove button is shown.
 */
export const AttachmentChip = ({ attachment, onRemove, className }: AttachmentChipProps) => {
    return (
        <div
            className={cn(
                "group flex items-center gap-1.5 max-w-[240px] rounded-md border bg-background pl-2 pr-1 py-1 text-xs",
                className,
            )}
        >
            <Dialog>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className="flex items-center gap-1.5 min-w-0 hover:underline"
                        title={`Preview ${attachment.name}`}
                    >
                        <FileTextIcon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate">{attachment.name}</span>
                        <span className="flex-shrink-0 text-muted-foreground">{formatBytes(attachment.size)}</span>
                    </button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="truncate">{attachment.name}</DialogTitle>
                        <DialogDescription>
                            {attachment.mediaType} · {formatBytes(attachment.size)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-auto min-h-0">
                        <CodeBlock code={attachment.content} language={getLanguageFromName(attachment.name)} />
                    </div>
                </DialogContent>
            </Dialog>
            {onRemove && (
                <button
                    type="button"
                    className="flex items-center justify-center w-4 h-4 flex-shrink-0 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={onRemove}
                    title={`Remove ${attachment.name}`}
                >
                    <XIcon className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
