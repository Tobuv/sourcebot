'use client';

import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DynamicToolUIPart } from "ai";
import { ChevronDown, PlugIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { MCP_TOOL_NAME_SEPARATOR, McpToolOutput } from "../../../mcpConnectors/mcpConnectorUtils";

const isMcpToolOutput = (output: unknown): output is McpToolOutput => {
    return typeof output === 'object' && output !== null && 'server' in output && 'tool' in output && 'output' in output;
}

/**
 * Renders a call to a tool from a third-party MCP server.
 */
export const McpToolComponent = ({ part }: { part: DynamicToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const output = part.state === 'output-available' && isMcpToolOutput(part.output) ? part.output : undefined;
    const [fallbackServer, ...rest] = part.toolName.split(MCP_TOOL_NAME_SEPARATOR);
    const server = output?.server ?? fallbackServer;
    const tool = output?.tool ?? (rest.join(MCP_TOOL_NAME_SEPARATOR) || part.toolName);

    const hasInput = part.state !== 'input-streaming';
    const requestText = hasInput ? JSON.stringify(part.input, null, 2) : '';
    const responseText = part.state === 'output-error'
        ? (part.errorText ?? '')
        : output?.output;
    const isError = part.state === 'output-error' || output?.isError === true;

    const onCopyRequest = useCallback(() => {
        navigator.clipboard.writeText(requestText);
        return true;
    }, [requestText]);

    const onCopyResponse = useCallback(() => {
        if (!responseText) {
            return false;
        }
        navigator.clipboard.writeText(responseText);
        return true;
    }, [responseText]);

    const isRunning = part.state === 'input-streaming' || part.state === 'input-available';

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PlugIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={cn("flex-shrink-0", isRunning && "animate-pulse", isError && "text-destructive")}>
                    {isRunning ? 'Calling' : isError ? 'Failed' : 'Called'}
                </span>
                <span className="text-xs truncate">
                    <span className="font-medium">{server}</span>
                    <span className="mx-1">·</span>
                    <span className="font-mono">{tool}</span>
                </span>
                <span className="flex-1" />
                <Separator orientation="vertical" className="h-3 flex-shrink-0" />
                {hasInput && (
                    <button
                        onClick={() => setIsExpanded((value) => !value)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                        <span>Details</span>
                        <ChevronDown className={cn("h-3 w-3 transition-transform -rotate-90", isExpanded && "rotate-0")} />
                    </button>
                )}
            </div>
            {hasInput && isExpanded && (
                <div className="rounded-lg border border-border text-xs overflow-y-auto max-h-72">
                    <Section label="Request" onCopy={onCopyRequest}>
                        <pre className="whitespace-pre-wrap break-all font-mono">{requestText}</pre>
                    </Section>
                    {responseText !== undefined && (
                        <>
                            <div className="border-t border-border" />
                            <Section label="Response" onCopy={onCopyResponse}>
                                <pre className={cn("whitespace-pre-wrap break-all font-mono", isError && "text-destructive")}>
                                    {responseText}
                                </pre>
                            </Section>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

const Section = ({ label, onCopy, children }: { label: string; onCopy: () => boolean; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1.5">
        <div className="sticky top-0 flex items-center justify-between bg-muted px-3 py-1.5 border-b border-border">
            <span className="font-medium text-foreground">{label}</span>
            <CopyIconButton onCopy={onCopy} />
        </div>
        <div className="text-muted-foreground p-3">
            {children}
        </div>
    </div>
);
