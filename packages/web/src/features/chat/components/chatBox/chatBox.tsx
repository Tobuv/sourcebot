'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomEditor, LanguageModelInfo, MentionElement, RenderElementPropsFor, SearchScope } from "@/features/chat/types";
import { insertMention, slateContentToString } from "@/features/chat/utils";
import { cn } from "@/lib/utils";
import { useIsMac } from "@/hooks/useIsMac";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import { ArrowUp, Loader2, PaperclipIcon, SparklesIcon, StopCircleIcon } from "lucide-react";
import { ClipboardEvent, DragEvent, Fragment, KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Descendant, insertText } from "slate";
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, useFocused, useSelected, useSlate } from "slate-react";
import { useSelectedLanguageModel } from "../../useSelectedLanguageModel";
import { SuggestionBox } from "./suggestionsBox";
import { Suggestion } from "./types";
import { useSuggestionModeAndQuery } from "./useSuggestionModeAndQuery";
import { useSuggestionsData } from "./useSuggestionsData";
import { useToast } from "@/components/hooks/use-toast";
import { SearchContextQuery } from "@/lib/types";
import isEqual from "fast-deep-equal/react";
import { createPastedTextAttachment, readFileAsTextAttachment, shouldConvertPasteToAttachment, TextAttachment, validateAttachments } from "../../attachments";
import { AttachmentChip } from "../attachmentChip";

interface ChatBoxProps {
    onSubmit: (children: Descendant[], editor: CustomEditor, attachments: TextAttachment[]) => void;
    onStop?: () => void;
    preferredSuggestionsBoxPlacement?: "top-start" | "bottom-start";
    className?: string;
    isRedirecting?: boolean;
    isGenerating?: boolean;
    isDisabled?: boolean;
    languageModels: LanguageModelInfo[];
    selectedSearchScopes: SearchScope[];
    searchContexts: SearchContextQuery[];
}

const ChatBoxComponent = ({
    onSubmit: _onSubmit,
    onStop,
    preferredSuggestionsBoxPlacement = "bottom-start",
    className,
    isRedirecting,
    isGenerating,
    isDisabled,
    languageModels,
    selectedSearchScopes,
    searchContexts,
}: ChatBoxProps) => {
    const suggestionsBoxRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const editor = useSlate();
    const { suggestionQuery, suggestionMode: rawSuggestionMode, range } = useSuggestionModeAndQuery();
    const { suggestions, isLoading } = useSuggestionsData({
        suggestionMode: rawSuggestionMode,
        suggestionQuery,
        selectedRepos: selectedSearchScopes.map((item) => {
            if (item.type === 'repo') {
                return [item.value];
            }

            if (item.type === 'reposet') {
                const reposet = searchContexts.find((reposet) => reposet.name === item.value);
                if (reposet) {
                    return reposet.repoNames;
                }
            }

            return [];
        }).flat(),
    });
    // A word like `/usr` that matches no skill is just text: don't show the suggestion box
    // (which would also swallow the Enter key). A bare `/` still shows the box so users
    // can discover skills.
    const suggestionMode = rawSuggestionMode === 'skill' && !isLoading && suggestions.length === 0 && suggestionQuery.length > 0
        ? 'none'
        : rawSuggestionMode;

    const { selectedLanguageModel } = useSelectedLanguageModel({
        languageModels,
    });
    const { toast } = useToast();
    const [attachments, setAttachments] = useState<TextAttachment[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Latest attachments, for use after async file reads.
    const attachmentsRef = useRef<TextAttachment[]>([]);
    useEffect(() => {
        attachmentsRef.current = attachments;
    }, [attachments]);

    // Adds attachments if they fit within the per-message limits, otherwise shows an error.
    const addAttachments = useCallback((newAttachments: TextAttachment[]) => {
        if (newAttachments.length === 0) {
            return false;
        }

        const next = [...attachmentsRef.current, ...newAttachments];
        const error = validateAttachments(next);
        if (error) {
            toast({ description: `⚠️ ${error}`, variant: "destructive" });
            return false;
        }

        attachmentsRef.current = next;
        setAttachments(next);
        return true;
    }, [toast]);

    const addFiles = useCallback(async (files: File[]) => {
        const results = await Promise.all(files.map(readFileAsTextAttachment));
        const valid: TextAttachment[] = [];
        for (const result of results) {
            if ('error' in result) {
                toast({ description: `⚠️ ${result.error}`, variant: "destructive" });
            } else {
                valid.push(result);
            }
        }
        addAttachments(valid);
    }, [addAttachments, toast]);

    const onPaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
        const files = Array.from(event.clipboardData.files);
        const text = event.clipboardData.getData('text/plain');

        if (files.length > 0 && !text) {
            event.preventDefault();
            addFiles(files);
            return;
        }

        if (text && shouldConvertPasteToAttachment(text)) {
            event.preventDefault();
            const added = addAttachments([createPastedTextAttachment(text, attachmentsRef.current)]);
            if (added) {
                toast({ description: "Large paste was added as an attachment." });
            }
        }
    }, [addAttachments, addFiles, toast]);

    const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        if (isDisabled || !event.dataTransfer.types.includes('Files')) {
            return;
        }
        event.preventDefault();
        setIsDraggingOver(true);
    }, [isDisabled]);

    const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
        // Ignore leave events fired when moving between child elements.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
        }
        setIsDraggingOver(false);
    }, []);

    const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
        setIsDraggingOver(false);
        if (isDisabled) {
            return;
        }
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) {
            return;
        }
        event.preventDefault();
        addFiles(files);
    }, [addFiles, isDisabled]);

    // Reset the index when the suggestion mode changes.
    useEffect(() => {
        setIndex(0);
    }, [suggestionMode]);

    // Hotkey to focus the chat box.
    useHotkeys("/", (e) => {
        e.preventDefault();
        ReactEditor.focus(editor);
    });

    // Auto-focus chat box when the component mounts.
    useEffect(() => {
        ReactEditor.focus(editor);
    }, [editor]);

    const renderElement = useCallback((props: RenderElementProps) => {
        switch (props.element.type) {
            case 'mention':
                return <MentionComponent {...props as RenderElementPropsFor<MentionElement>} />
            default:
                return <DefaultElement {...props} />
        }
    }, []);

    const renderLeaf = useCallback((props: RenderLeafProps) => {
        return <Leaf {...props} />
    }, []);

    const { isSubmitDisabled, isSubmitDisabledReason } = useMemo((): {
        isSubmitDisabled: true,
        isSubmitDisabledReason: "empty" | "redirecting" | "generating" | "no-language-model-selected"
    } | {
        isSubmitDisabled: false,
        isSubmitDisabledReason: undefined,
    } => {
        if (slateContentToString(editor.children).trim().length === 0) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "empty",
            }
        }

        if (isRedirecting) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "redirecting",
            }
        }

        if (isGenerating) {
            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "generating",
            }
        }

        if (selectedLanguageModel === undefined) {

            return {
                isSubmitDisabled: true,
                isSubmitDisabledReason: "no-language-model-selected",
            }
        }

        return {
            isSubmitDisabled: false,
            isSubmitDisabledReason: undefined,
        }

    }, [editor.children, isRedirecting, isGenerating, selectedLanguageModel])

    const onSubmit = useCallback(() => {
        if (isSubmitDisabled) {
            if (isSubmitDisabledReason === "no-language-model-selected") {
                toast({
                    description: "⚠️ You must select a language model",
                    variant: "destructive",
                });
            }

            return;
        }

        _onSubmit(editor.children, editor, attachments);
        attachmentsRef.current = [];
        setAttachments([]);
    }, [_onSubmit, editor, attachments, isSubmitDisabled, isSubmitDisabledReason, toast]);

    const onInsertSuggestion = useCallback((suggestion: Suggestion) => {
        switch (suggestion.type) {
            case 'file':
                insertMention(editor, {
                    type: 'file',
                    path: suggestion.path,
                    repo: suggestion.repo,
                    name: suggestion.name,
                    language: suggestion.language,
                    revision: suggestion.revision,
                }, range);
                break;
            case 'skill':
                insertMention(editor, {
                    type: 'skill',
                    id: suggestion.id,
                    name: suggestion.name,
                    description: suggestion.description,
                }, range);
                break;
            case 'refine': {
                switch (suggestion.targetSuggestionMode) {
                    case 'file':
                        insertText(editor, 'file:');
                        break;
                }
                break;
            }
        }
        ReactEditor.focus(editor);
    }, [editor, range]);

    const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (suggestionMode === "none") {
            switch (event.key) {
                case 'Enter': {
                    if (event.shiftKey) {
                        break;
                    }

                    if (event.altKey) {
                        event.preventDefault();
                        editor.insertBreak();
                        break;
                    }

                    event.preventDefault();
                    onSubmit();
                    break;
                }
            }
        }
        else if (suggestions.length > 0) {
            switch (event.key) {
                case 'ArrowDown': {
                    event.preventDefault();
                    const prevIndex = index >= suggestions.length - 1 ? 0 : index + 1
                    setIndex(prevIndex)
                    break;
                }
                case 'ArrowUp': {
                    event.preventDefault();
                    const nextIndex = index <= 0 ? suggestions.length - 1 : index - 1
                    setIndex(nextIndex)
                    break;
                }
                case 'Tab':
                case 'Enter': {
                    event.preventDefault();
                    const suggestion = suggestions[index];
                    onInsertSuggestion(suggestion);
                    break;
                }
                case 'Escape': {
                    event.preventDefault();
                    break;
                }
            }
        }
    }, [suggestionMode, suggestions, onSubmit, editor, index, onInsertSuggestion]);

    useEffect(() => {
        if (!range || !suggestionsBoxRef.current) {
            return;
        }

        const virtualElement: VirtualElement = {
            getBoundingClientRect: () => {
                if (!range) {
                    return new DOMRect();
                }

                return ReactEditor.toDOMRange(editor, range).getBoundingClientRect();
            }
        }

        computePosition(virtualElement, suggestionsBoxRef.current, {
            placement: preferredSuggestionsBoxPlacement,
            middleware: [
                offset(2),
                flip({
                    mainAxis: true,
                    crossAxis: false,
                    fallbackPlacements: ['top-start', 'bottom-start'],
                    padding: 20,
                }),
                shift({
                    padding: 5,
                })
            ]
        }).then(({ x, y }) => {
            if (suggestionsBoxRef.current) {
                suggestionsBoxRef.current.style.left = `${x}px`;
                suggestionsBoxRef.current.style.top = `${y}px`;
            }
        })
    }, [editor, index, range, preferredSuggestionsBoxPlacement]);

    return (
        <div
            className={cn(
                "flex flex-col justify-between gap-0.5 w-full px-3 py-2",
                isDraggingOver && "outline-dashed outline-2 outline-primary/60 -outline-offset-2 rounded-md",
                className,
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {attachments.map((attachment, index) => (
                        <AttachmentChip
                            key={`${attachment.name}-${index}`}
                            attachment={attachment}
                            onRemove={() => {
                                const next = attachments.filter((_, i) => i !== index);
                                attachmentsRef.current = next;
                                setAttachments(next);
                            }}
                        />
                    ))}
                </div>
            )}
            <Editable
                className="w-full focus-visible:outline-none focus-visible:ring-0 bg-background text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm max-h-64 overflow-y-auto"
                placeholder="Ask a question about your code. @mention files, type / to use a skill, or select search scopes to refine your query."
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                readOnly={isDisabled}
            />
            <div className="ml-auto z-10 flex items-center gap-1">
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        // Reset so that selecting the same file again triggers onChange.
                        event.target.value = '';
                        addFiles(files);
                    }}
                />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isDisabled || isRedirecting}
                        >
                            <PaperclipIcon className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        Attach text files (or drag &amp; drop / paste)
                    </TooltipContent>
                </Tooltip>
                {isRedirecting ? (
                    <Button
                        variant="default"
                        disabled={true}
                        size="icon"
                        className="w-6 h-6"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </Button>
                ) :
                    isGenerating ? (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-8"
                            onClick={onStop}
                        >
                            <StopCircleIcon className="w-4 h-4" />
                            Stop
                        </Button>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    onClick={() => {
                                        // @hack: When submission is disabled, we still want to issue
                                        // a warning to the user as to why the submission is disabled.
                                        // onSubmit on the Button will not be called because of the
                                        // disabled prop, hence the call here.
                                        if (isSubmitDisabled) {
                                            onSubmit();
                                        }
                                    }}
                                >
                                    <Button
                                        variant={isSubmitDisabled ? "outline" : "default"}
                                        size="sm"
                                        className="w-6 h-6"
                                        onClick={onSubmit}
                                        disabled={isSubmitDisabled}
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TooltipTrigger>
                        </Tooltip>
                    )}
            </div>
            {suggestionMode !== "none" && (
                <SuggestionBox
                    ref={suggestionsBoxRef}
                    selectedIndex={index}
                    onInsertSuggestion={onInsertSuggestion}
                    isLoading={isLoading}
                    suggestions={suggestions}
                    emptyMessage={suggestionMode === 'skill' ? "No skills yet. Create one in Settings → Skills." : undefined}
                />
            )}
        </div>
    )
}

export const ChatBox = memo(ChatBoxComponent, isEqual);

const DefaultElement = (props: RenderElementProps) => {
    return <p {...props.attributes}>{props.children}</p>
}

const Leaf = (props: RenderLeafProps) => {
    return (
        <span
            {...props.attributes}
        >
            {props.children}
        </span>
    )
}

const MentionComponent = ({
    attributes,
    children,
    element: { data },
}: RenderElementPropsFor<MentionElement>) => {
    const selected = useSelected();
    const focused = useFocused();
    const isMac = useIsMac();

    if (data.type === 'file') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        {...attributes}
                        contentEditable={false}
                        className={cn(
                            "px-1.5 py-0.5 mr-1.5 mb-1 align-baseline inline-block rounded bg-muted text-xs font-mono",
                            {
                                "ring-2 ring-blue-300": selected && focused
                            }
                        )}
                    >
                        <span contentEditable={false} className="flex flex-row items-center select-none">
                            {/* @see: https://github.com/ianstormtaylor/slate/issues/3490 */}
                            {isMac ? (
                                <Fragment>
                                    {children}
                                    <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-1" />
                                    {data.name}
                                </Fragment>
                            ) : (
                                <Fragment>
                                    <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-1" />
                                    {data.name}
                                    {children}
                                </Fragment>
                            )}
                        </span>
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <span className="text-xs font-mono">
                        <span className="font-medium">{data.repo.split('/').pop()}</span>/{data.path}
                    </span>
                </TooltipContent>
            </Tooltip>
        )
    }

    if (data.type === 'skill') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        {...attributes}
                        contentEditable={false}
                        className={cn(
                            "px-1.5 py-0.5 mr-1.5 mb-1 align-baseline inline-block rounded bg-muted text-xs font-mono",
                            {
                                "ring-2 ring-blue-300": selected && focused
                            }
                        )}
                    >
                        <span contentEditable={false} className="flex flex-row items-center select-none">
                            {/* @see: https://github.com/ianstormtaylor/slate/issues/3490 */}
                            {isMac ? (
                                <Fragment>
                                    {children}
                                    <SparklesIcon className="w-3 h-3 mr-1" />
                                    /{data.name}
                                </Fragment>
                            ) : (
                                <Fragment>
                                    <SparklesIcon className="w-3 h-3 mr-1" />
                                    /{data.name}
                                    {children}
                                </Fragment>
                            )}
                        </span>
                    </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                    <span className="text-xs">{data.description}</span>
                </TooltipContent>
            </Tooltip>
        )
    }

    return null;
}
