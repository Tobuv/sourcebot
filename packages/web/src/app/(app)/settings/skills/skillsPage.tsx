'use client';

import { listSkills } from "@/app/api/(client)/client";
import { useToast } from "@/components/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteSkill } from "@/features/chat/skills/actions";
import { parseSkillMarkdown, serializeSkillMarkdown, SkillInfo } from "@/features/chat/skills/skillUtils";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, EyeIcon, PencilIcon, Plus, SparklesIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { SkillEditorDialog, SkillEditorState } from "./skillEditorDialog";
import { useTranslations } from "next-intl";

const SKILLS_QUERY_KEY = ["chatSkills"];

const downloadSkill = (skill: SkillInfo) => {
    const blob = new Blob([serializeSkillMarkdown(skill)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${skill.name}.SKILL.md`;
    link.click();
    URL.revokeObjectURL(url);
}

export const SkillsPage = ({ isOwner }: { isOwner: boolean }) => {
    const t = useTranslations('skills');
    const tCommon = useTranslations('common');
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const importInputRef = useRef<HTMLInputElement>(null);
    const [editorState, setEditorState] = useState<SkillEditorState | null>(null);
    const [editorKey, setEditorKey] = useState(0);
    const [skillToDelete, setSkillToDelete] = useState<SkillInfo | null>(null);

    const { data: skills, isLoading, isError } = useQuery({
        queryKey: SKILLS_QUERY_KEY,
        queryFn: () => unwrapServiceError(listSkills()),
    });

    const openEditor = useCallback((state: SkillEditorState) => {
        setEditorKey((key) => key + 1);
        setEditorState(state);
    }, []);

    const onImport = useCallback(async (files: File[]) => {
        const file = files[0];
        if (!file) {
            return;
        }

        // e.g. "review-pr.SKILL.md" or "review-pr.md" -> "review-pr". A bare "SKILL.md" has no usable name.
        const fallbackName = file.name.replace(/(\.skill)?\.md$/i, '');
        const parsed = parseSkillMarkdown(await file.text(), fallbackName.toLowerCase() === 'skill' ? undefined : fallbackName);
        if ('error' in parsed) {
            toast({ description: t('importFailed', { file: file.name, reason: parsed.error }), variant: "destructive" });
            return;
        }

        openEditor({
            mode: 'create',
            initialValues: { ...parsed, scope: 'PERSONAL', autoInvoke: true },
        });
    }, [openEditor, toast, t]);

    const onConfirmDelete = useCallback(async () => {
        if (!skillToDelete) {
            return;
        }

        const result = await deleteSkill(skillToDelete.id);
        if (isServiceError(result)) {
            toast({ description: `❌ ${result.message}`, variant: "destructive" });
        } else {
            toast({ description: t('deleted', { name: skillToDelete.name }) });
            queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
        }
        setSkillToDelete(null);
    }, [skillToDelete, toast, queryClient, t]);

    const personalSkills = skills?.filter((skill) => skill.scope === 'PERSONAL') ?? [];
    const workspaceSkills = skills?.filter((skill) => skill.scope === 'WORKSPACE') ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium">{t('title')}</h3>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        {t.rich('description', { code: (chunks) => <code>{chunks}</code> })}
                    </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".md,text/markdown,text/plain"
                        className="hidden"
                        onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            event.target.value = '';
                            onImport(files);
                        }}
                    />
                    <Button variant="outline" onClick={() => importInputRef.current?.click()}>
                        <UploadIcon className="h-4 w-4 mr-2" />
                        {t('import')}
                    </Button>
                    <Button onClick={() => openEditor({ mode: 'create' })}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('new')}
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : isError ? (
                <p className="text-sm text-destructive">{t('loadFailed')}</p>
            ) : (
                <>
                    <SkillSection
                        title={t('personalTitle')}
                        description={t('personalDescription')}
                        emptyText={t('personalEmpty')}
                        skills={personalSkills}
                        onView={(skill) => openEditor({ mode: skill.canEdit ? 'edit' : 'view', skill })}
                        onDelete={setSkillToDelete}
                    />
                    <SkillSection
                        title={t('workspaceTitle')}
                        description={isOwner ? t('workspaceDescriptionOwner') : t('workspaceDescription')}
                        emptyText={t('workspaceEmpty')}
                        skills={workspaceSkills}
                        onView={(skill) => openEditor({ mode: skill.canEdit ? 'edit' : 'view', skill })}
                        onDelete={setSkillToDelete}
                    />
                </>
            )}

            <SkillEditorDialog
                key={editorKey}
                state={editorState}
                isOwner={isOwner}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditorState(null);
                    }
                }}
                onSaved={() => {
                    setEditorState(null);
                    queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY });
                }}
            />

            <AlertDialog open={skillToDelete !== null} onOpenChange={(open) => !open && setSkillToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteTitle', { name: skillToDelete?.name ?? '' })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {skillToDelete?.scope === 'WORKSPACE'
                                ? t('deleteWorkspace')
                                : t('deletePersonal')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={onConfirmDelete}>{tCommon('delete')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

interface SkillSectionProps {
    title: string;
    description: string;
    emptyText: string;
    skills: SkillInfo[];
    onView: (skill: SkillInfo) => void;
    onDelete: (skill: SkillInfo) => void;
}

const SkillSection = ({ title, description, emptyText, skills, onView, onDelete }: SkillSectionProps) => {
    const t = useTranslations('skills');
    return (
        <div className="flex flex-col gap-2">
            <div>
                <h4 className="text-sm font-medium">{title}</h4>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {skills.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {emptyText}
                </div>
            ) : (
                <div className="flex flex-col divide-y rounded-md border">
                    {skills.map((skill) => (
                        <div key={skill.id} className="flex items-start gap-3 p-3">
                            <SparklesIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        className="font-mono text-sm font-medium hover:underline"
                                        onClick={() => onView(skill)}
                                    >
                                        /{skill.name}
                                    </button>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {skill.autoInvoke ? t('autoAndManual') : t('manualOnly')}
                                    </Badge>
                                    {skill.isShadowed && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                            {t('overridden')}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
                                {skill.scope === 'WORKSPACE' && skill.createdByName && (
                                    <p className="text-[11px] text-muted-foreground">Created by {skill.createdByName}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title={skill.canEdit ? 'Edit' : 'View'}
                                    onClick={() => onView(skill)}
                                >
                                    {skill.canEdit ? <PencilIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title={t('export')}
                                    onClick={() => downloadSkill(skill)}
                                >
                                    <DownloadIcon className="h-3.5 w-3.5" />
                                </Button>
                                {skill.canEdit && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        title="Delete"
                                        onClick={() => onDelete(skill)}
                                    >
                                        <Trash2Icon className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
