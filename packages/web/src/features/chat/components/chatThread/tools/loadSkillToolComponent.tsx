'use client';

import { ToolResult } from "@/features/tools";
import { Separator } from "@/components/ui/separator";
import { SparklesIcon } from "lucide-react";
import { LoadSkillMetadata } from "../../../skills/loadSkillTool";

export const LoadSkillToolComponent = ({ metadata }: ToolResult<LoadSkillMetadata>) => {
    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <SparklesIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-shrink-0">{metadata.found ? 'Loaded skill' : 'Skill not found'}</span>
            <span className="font-mono text-xs truncate">/{metadata.name}</span>
            <span className="flex-1" />
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
