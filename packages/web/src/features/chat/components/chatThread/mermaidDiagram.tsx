'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckIcon, CodeIcon, CopyIcon, DownloadIcon, ImageIcon, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useId, useState } from 'react';
import { CodeBlock } from './codeBlock';
import { useTranslations } from "next-intl";

interface MermaidDiagramProps {
    code: string;
}

// Wait for the source to stop changing before rendering. While an answer is
// streaming the code block grows token by token and most intermediate states
// are not valid diagrams.
const RENDER_DEBOUNCE_MS = 400;

interface RenderState {
    /** The most recent successfully rendered SVG, kept while re-rendering or after a later invalid edit. */
    svg?: string;
    /** The error from the most recent render attempt, if it failed. */
    error?: string;
    isRendering: boolean;
}

let renderCounter = 0;

const renderMermaid = async (code: string, isDarkMode: boolean, idPrefix: string): Promise<string> => {
    const { default: mermaid } = await import('mermaid');

    mermaid.initialize({
        startOnLoad: false,
        // Strict mode sanitizes labels and disables click handlers / scripts.
        securityLevel: 'strict',
        theme: isDarkMode ? 'dark' : 'default',
        fontFamily: 'inherit',
    });

    // Validate first: `render` leaves error artifacts in the DOM when parsing fails.
    await mermaid.parse(code);

    const id = `${idPrefix}-${++renderCounter}`;
    const { svg } = await mermaid.render(id, code);
    return svg;
}

export const MermaidDiagram = ({ code }: MermaidDiagramProps) => {
    const t = useTranslations('chatThread');
    const { resolvedTheme } = useTheme();
    const isDarkMode = resolvedTheme === 'dark';
    const idPrefix = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const [state, setState] = useState<RenderState>({ isRendering: true });
    const [isSourceVisible, setIsSourceVisible] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        setState((prev) => ({ ...prev, isRendering: true }));

        const timeout = setTimeout(() => {
            renderMermaid(code, isDarkMode, idPrefix)
                .then((svg) => {
                    if (isCancelled) {
                        return;
                    }
                    setState({ svg, isRendering: false });
                })
                .catch((error: unknown) => {
                    if (isCancelled) {
                        return;
                    }
                    setState((prev) => ({
                        svg: prev.svg,
                        error: error instanceof Error ? error.message : String(error),
                        isRendering: false,
                    }));
                });
        }, RENDER_DEBOUNCE_MS);

        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [code, isDarkMode, idPrefix]);

    const onCopySource = useCallback(() => {
        navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
    }, [code]);

    const onDownloadSvg = useCallback(() => {
        if (!state.svg) {
            return;
        }
        const blob = new Blob([state.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagram.svg';
        link.click();
        URL.revokeObjectURL(url);
    }, [state.svg]);

    // If the diagram never rendered successfully, fall back to showing the source.
    if (state.error && !state.svg) {
        return (
            <div className="not-prose my-4">
                <CodeBlock code={code} language="mermaid" />
                <p className="text-xs text-muted-foreground mt-1">
                    Unable to render diagram: {state.error.split('\n')[0]}
                </p>
            </div>
        );
    }

    const { svg } = state;

    return (
        <div className="not-prose my-4 flex flex-col rounded-md border overflow-hidden">
            <div className="flex items-center justify-between border-b bg-accent/50 px-2 py-1">
                <span className="text-xs text-muted-foreground">{t('diagram')}</span>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={isSourceVisible ? t('showDiagram') : t('showSource')}
                        onClick={() => setIsSourceVisible(!isSourceVisible)}
                    >
                        {isSourceVisible ? <ImageIcon className="h-3 w-3" /> : <CodeIcon className="h-3 w-3" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('copySource')}
                        onClick={onCopySource}
                    >
                        {isCopied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('downloadSvg')}
                        disabled={!svg}
                        onClick={onDownloadSvg}
                    >
                        <DownloadIcon className="h-3 w-3" />
                    </Button>
                </div>
            </div>
            {isSourceVisible ? (
                <CodeBlock code={code} language="mermaid" />
            ) : svg ? (
                <div
                    className={cn(
                        "flex justify-center overflow-auto p-4 [&_svg]:max-w-full [&_svg]:h-auto",
                        state.isRendering && "opacity-60",
                    )}
                    // The SVG is produced by mermaid with securityLevel 'strict', which sanitizes its output.
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            ) : (
                <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Rendering diagram…
                </div>
            )}
        </div>
    );
}
