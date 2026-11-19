'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createSkill, updateSkill } from "@/features/chat/skills/actions";
import {
    SKILL_DESCRIPTION_MAX_LENGTH,
    SKILL_INSTRUCTIONS_MAX_LENGTH,
    SKILL_NAME_MAX_LENGTH,
    SkillInfo,
    SkillInput,
    skillInputSchema,
    toSkillName,
} from "@/features/chat/skills/skillUtils";
import { isServiceError } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export type SkillEditorState =
    | { mode: 'create', initialValues?: Partial<SkillInput> }
    | { mode: 'edit', skill: SkillInfo }
    | { mode: 'view', skill: SkillInfo };

interface SkillEditorDialogProps {
    state: SkillEditorState | null;
    isOwner: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (skill: SkillInfo) => void;
}

const EMPTY_VALUES: SkillInput = {
    name: '',
    description: '',
    instructions: '',
    scope: 'PERSONAL',
    autoInvoke: true,
};

const getInitialValues = (state: SkillEditorState | null): SkillInput => {
    if (!state) {
        return EMPTY_VALUES;
    }

    if (state.mode === 'create') {
        return { ...EMPTY_VALUES, ...state.initialValues };
    }

    const { name, description, instructions, scope, autoInvoke } = state.skill;
    return { name, description, instructions, scope, autoInvoke };
}

/**
 * Note: render with a `key` that changes per opened skill so the form state resets.
 */
export const SkillEditorDialog = ({ state, isOwner, onOpenChange, onSaved }: SkillEditorDialogProps) => {
    const { toast } = useToast();
    const [values, setValues] = useState<SkillInput>(() => getInitialValues(state));
    const [errors, setErrors] = useState<Partial<Record<keyof SkillInput, string>>>({});
    const [isSaving, setIsSaving] = useState(false);

    const isReadOnly = state?.mode === 'view';
    const title = state?.mode === 'create' ? 'New skill' : state?.mode === 'edit' ? 'Edit skill' : 'View skill';

    const onSave = async () => {
        if (!state || isReadOnly) {
            return;
        }

        const parsed = skillInputSchema.safeParse(values);
        if (!parsed.success) {
            const fieldErrors: Partial<Record<keyof SkillInput, string>> = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0] as keyof SkillInput;
                fieldErrors[field] ??= issue.message;
            }
            setErrors(fieldErrors);
            return;
        }

        setIsSaving(true);
        const result = state.mode === 'edit'
            ? await updateSkill(state.skill.id, parsed.data)
            : await createSkill(parsed.data);
        setIsSaving(false);

        if (isServiceError(result)) {
            toast({ description: `❌ ${result.message}`, variant: "destructive" });
            return;
        }

        toast({ description: `✅ Saved skill /${result.name}` });
        onSaved(result);
    };

    return (
        <Dialog open={state !== null} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Skills are reusable instructions for Ask Sourcebot. Use one by typing <code>/{values.name || 'name'}</code> in the chat box{values.autoInvoke ? ', or let the agent load it automatically when your question matches its description' : ''}.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 overflow-y-auto px-1 -mx-1">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="skill-name">Name</Label>
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground font-mono text-sm">/</span>
                            <Input
                                id="skill-name"
                                value={values.name}
                                maxLength={SKILL_NAME_MAX_LENGTH}
                                placeholder="review-pr"
                                className="font-mono"
                                disabled={isReadOnly}
                                onChange={(event) => setValues({ ...values, name: event.target.value.toLowerCase().replace(/[\s_]+/g, '-') })}
                                onBlur={() => setValues((prev) => ({ ...prev, name: toSkillName(prev.name) }))}
                            />
                        </div>
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="skill-description">Description</Label>
                        <Textarea
                            id="skill-description"
                            value={values.description}
                            maxLength={SKILL_DESCRIPTION_MAX_LENGTH}
                            rows={2}
                            placeholder="What the skill does and when to use it, e.g. &quot;Review a pull request for bugs and style issues. Use when the user asks to review a PR or diff.&quot;"
                            disabled={isReadOnly}
                            onChange={(event) => setValues({ ...values, description: event.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                            The agent uses the description to decide when to load the skill automatically.
                        </p>
                        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="skill-instructions">Instructions</Label>
                        <Textarea
                            id="skill-instructions"
                            value={values.instructions}
                            maxLength={SKILL_INSTRUCTIONS_MAX_LENGTH}
                            rows={12}
                            className="font-mono text-xs"
                            placeholder={"Markdown instructions the agent follows when the skill is used.\n\n## Steps\n1. ...\n2. ..."}
                            disabled={isReadOnly}
                            onChange={(event) => setValues({ ...values, instructions: event.target.value })}
                        />
                        {errors.instructions && <p className="text-xs text-destructive">{errors.instructions}</p>}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex flex-col gap-1.5 sm:w-1/2">
                            <Label>Scope</Label>
                            <Select
                                value={values.scope}
                                disabled={isReadOnly}
                                onValueChange={(scope) => setValues({ ...values, scope: scope as SkillInput['scope'] })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PERSONAL">Personal (only you)</SelectItem>
                                    <SelectItem value="WORKSPACE" disabled={!isOwner}>
                                        Workspace (all members){!isOwner ? ' · owners only' : ''}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-start justify-between gap-3 sm:w-1/2 rounded-md border p-3">
                            <div className="flex flex-col gap-0.5">
                                <Label htmlFor="skill-auto-invoke">Auto-invoke</Label>
                                <span className="text-xs text-muted-foreground">
                                    Let the agent load this skill when relevant.
                                </span>
                            </div>
                            <Switch
                                id="skill-auto-invoke"
                                checked={values.autoInvoke}
                                disabled={isReadOnly}
                                onCheckedChange={(autoInvoke) => setValues({ ...values, autoInvoke })}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {isReadOnly ? 'Close' : 'Cancel'}
                    </Button>
                    {!isReadOnly && (
                        <Button onClick={onSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
