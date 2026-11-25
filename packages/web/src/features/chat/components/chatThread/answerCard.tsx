'use client';

import { useExtractTOCItems } from "../../useTOCItems";
import { TableOfContents } from "./tableOfContents";
import { Button } from "@/components/ui/button";
import { TableOfContentsIcon, ThumbsDown, ThumbsUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "./markdownRenderer";
import { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { useToast } from "@/components/hooks/use-toast";
import { convertLLMOutputToPortableMarkdown } from "../../utils";
import { submitFeedback } from "../../actions";
import { isServiceError } from "@/lib/utils";
import { LangfuseWeb } from "langfuse";
import { env } from "@sourcebot/shared/client";
import isEqual from "fast-deep-equal/react";
import { FileSource } from "../../types";
import { useTranslations } from "next-intl";

interface AnswerCardProps {
    answerText: string;
    messageId: string;
    chatId: string;
    traceId?: string;
    sources: FileSource[];
}

const langfuseWeb = env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY ? new LangfuseWeb({
    publicKey: env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
    baseUrl: env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
}) : null;

const AnswerCardComponent = forwardRef<HTMLDivElement, AnswerCardProps>(({
    answerText,
    messageId,
    chatId,
    traceId,
    sources,
}, forwardedRef) => {
    const t = useTranslations('chatThread');
    const markdownRendererRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line react-hooks/refs -- ref.current is passed to a custom hook, not used directly in render output
    const { tocItems, activeId } = useExtractTOCItems({ target: markdownRendererRef.current });
    const [isTOCButtonToggled, setIsTOCButtonToggled] = useState(false);
    const { toast } = useToast();
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedback, setFeedback] = useState<'like' | 'dislike' | undefined>(undefined);

    useImperativeHandle(
        forwardedRef,
        () => markdownRendererRef.current as HTMLDivElement
    );

    const onCopyAnswer = useCallback(() => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const markdownText = convertLLMOutputToPortableMarkdown(answerText, baseUrl, sources);
        navigator.clipboard.writeText(markdownText);
        toast({
            description: t('copied'),
        });
        return true;
    }, [answerText, sources, toast, t]);

    const onFeedback = useCallback(async (feedbackType: 'like' | 'dislike') => {
        setIsSubmittingFeedback(true);

        const response = await submitFeedback({
            chatId,
            messageId,
            feedbackType
        });

        if (isServiceError(response)) {
            toast({
                description: t('feedbackFailed', { reason: response.message }),
                variant: "destructive"
            });
        } else {
            toast({
                description: t('feedbackSubmitted'),
            });
            setFeedback(feedbackType);

            langfuseWeb?.score({
                traceId: traceId,
                name: 'user_feedback',
                value: feedbackType === 'like' ? 1 : 0,
            })
        }

        setIsSubmittingFeedback(false);
    }, [chatId, messageId, toast, traceId, t]);

    return (
        <div className="flex flex-row w-full relative scroll-mt-16">
            {(isTOCButtonToggled && tocItems.length > 0) && (
                <TableOfContents
                    tocItems={tocItems}
                    activeId={activeId}
                    className="sticky top-0 h-fit max-w-44 py-2 mr-1.5"
                />
            )}
            <div className="flex flex-col w-full bg-[#fcfcfc] dark:bg-[#0e1320] px-4 py-2 rounded-lg shadow-sm">
                <div className="flex flex-col z-10 bg-inherit py-2 sticky top-0">
                    <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-muted-foreground">{t('answer')}</p>
                        <div className="flex items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <CopyIconButton
                                        onCopy={onCopyAnswer}
                                        className="h-6 w-6 text-muted-foreground"
                                    />
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                >
                                    {t('copyAnswer')}
                                </TooltipContent>
                            </Tooltip>
                            {tocItems.length > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Toggle
                                            className="h-6 w-6 px-3 min-w-6 text-muted-foreground"
                                            pressed={isTOCButtonToggled}
                                            onPressedChange={(next) => {
                                                setIsTOCButtonToggled(next);
                                            }}
                                        >
                                            <TableOfContentsIcon className="h-3 w-3" />
                                        </Toggle>
                                    </TooltipTrigger>
                                    <TooltipContent
                                        side="bottom"
                                    >
                                        {t('toggleToc')}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                    <Separator />
                </div>
                <MarkdownRenderer
                    ref={markdownRendererRef}
                    content={answerText}
                    // scroll-mt offsets the scroll position for headings to take account
                    // of the sticky "answer" header.
                    className="prose prose-sm max-w-none prose-headings:scroll-mt-14"
                />
                <Separator className="my-2" />
                <div className="flex gap-2">
                    <Button
                        variant={feedback === 'like' ? "default" : "ghost"}
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => onFeedback('like')}
                        disabled={isSubmittingFeedback || feedback !== undefined}
                    >
                        <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={feedback === 'dislike' ? "default" : "ghost"}
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => onFeedback('dislike')}
                        disabled={isSubmittingFeedback || feedback !== undefined}
                    >
                        <ThumbsDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>

        </div>
    )
})

AnswerCardComponent.displayName = 'AnswerCard';

export const AnswerCard = memo(AnswerCardComponent, isEqual);