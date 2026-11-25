'use client';

import { listCustomModels } from "@/app/api/(client)/client";
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
import { deleteCustomModel } from "@/features/chat/customModels/actions";
import { CUSTOM_MODEL_PROVIDER_INFO, CustomModelInfo } from "@/features/chat/customModels/customModelUtils";
import { ModelProviderLogo } from "@/features/chat/components/chatBox/modelProviderLogo";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, FileJsonIcon, PencilIcon, Plus, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ModelEditorDialog, ModelEditorState } from "./modelEditorDialog";
import { useTranslations } from "next-intl";

const QUERY_KEY = ["customLanguageModels"];

export const ModelsPage = ({ isOwner }: { isOwner: boolean }) => {
    const t = useTranslations('models');
    const tCommon = useTranslations('common');
    const { toast } = useToast();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [editorState, setEditorState] = useState<ModelEditorState | null>(null);
    const [editorKey, setEditorKey] = useState(0);
    const [modelToDelete, setModelToDelete] = useState<CustomModelInfo | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => unwrapServiceError(listCustomModels()),
    });

    const openEditor = useCallback((state: ModelEditorState) => {
        setEditorKey((key) => key + 1);
        setEditorState(state);
    }, []);

    const onChanged = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        // Model selectors are rendered from server data; refresh it.
        router.refresh();
    }, [queryClient, router]);

    const onConfirmDelete = useCallback(async () => {
        if (!modelToDelete) {
            return;
        }
        const result = await deleteCustomModel(modelToDelete.id);
        if (isServiceError(result)) {
            toast({ description: `❌ ${result.message}`, variant: "destructive" });
        } else {
            toast({ description: t('deleted', { name: modelToDelete.displayName }) });
            onChanged();
        }
        setModelToDelete(null);
    }, [modelToDelete, toast, onChanged, t]);

    const workspaceModels = data?.customModels.filter((model) => model.scope === 'WORKSPACE') ?? [];
    const personalModels = data?.customModels.filter((model) => model.scope === 'PERSONAL') ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium">{t('title')}</h3>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        {t('description')}
                    </p>
                </div>
                <Button onClick={() => openEditor({ mode: 'create' })} className="flex-shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('add')}
                </Button>
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            ) : isError || !data ? (
                <p className="text-sm text-destructive">{t('loadFailed')}</p>
            ) : (
                <>
                    <ModelSection
                        title={t('workspaceTitle')}
                        description={isOwner ? t('workspaceDescriptionOwner') : t('workspaceDescription')}
                        emptyText={t('workspaceEmpty')}
                        models={workspaceModels}
                        onOpen={(model) => openEditor({ mode: model.canEdit ? 'edit' : 'view', model })}
                        onDelete={setModelToDelete}
                    />
                    <ModelSection
                        title={t('personalTitle')}
                        description={t('personalDescription')}
                        emptyText={t('personalEmpty')}
                        models={personalModels}
                        onOpen={(model) => openEditor({ mode: model.canEdit ? 'edit' : 'view', model })}
                        onDelete={setModelToDelete}
                    />
                    {data.configFileModels.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div>
                                <h4 className="text-sm font-medium">{t('configTitle')}</h4>
                                <p className="text-xs text-muted-foreground">
                                    {t.rich('configDescription', { code: (chunks) => <code>{chunks}</code> })}
                                </p>
                            </div>
                            <div className="flex flex-col divide-y rounded-md border">
                                {data.configFileModels.map((model, index) => (
                                    <div key={`${model.provider}-${model.model}-${index}`} className="flex items-center gap-3 p-3">
                                        <ModelProviderLogo provider={model.provider as CustomModelInfo['provider']} className="w-4 h-4 flex-shrink-0" />
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-sm font-medium truncate">{model.displayName ?? model.model}</span>
                                            <span className="text-xs text-muted-foreground font-mono truncate">{model.provider} · {model.model}</span>
                                        </div>
                                        {model.imageInput && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t('images')}</Badge>}
                                        <FileJsonIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-label={t('fromConfig')} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <ModelEditorDialog
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
                    onChanged();
                }}
            />

            <AlertDialog open={modelToDelete !== null} onOpenChange={(open) => !open && setModelToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteTitle', { name: modelToDelete?.displayName ?? '' })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {modelToDelete?.scope === 'WORKSPACE'
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

interface ModelSectionProps {
    title: string;
    description: string;
    emptyText: string;
    models: CustomModelInfo[];
    onOpen: (model: CustomModelInfo) => void;
    onDelete: (model: CustomModelInfo) => void;
}

const ModelSection = ({ title, description, emptyText, models, onOpen, onDelete }: ModelSectionProps) => {
    const t = useTranslations('models');
    return (
    <div className="flex flex-col gap-2">
        <div>
            <h4 className="text-sm font-medium">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {models.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{emptyText}</div>
        ) : (
            <div className="flex flex-col divide-y rounded-md border">
                {models.map((model) => (
                    <div key={model.id} className="flex items-center gap-3 p-3">
                        <ModelProviderLogo provider={model.provider} className="w-4 h-4 flex-shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                            <button
                                type="button"
                                className="text-sm font-medium truncate text-left hover:underline"
                                onClick={() => onOpen(model)}
                            >
                                {model.displayName}
                            </button>
                            <span className="text-xs text-muted-foreground font-mono truncate">
                                {CUSTOM_MODEL_PROVIDER_INFO[model.provider]?.label ?? model.provider} · {model.model}
                                {model.baseUrl ? ` · ${model.baseUrl}` : ''}
                            </span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                            {model.imageInput && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t('images')}</Badge>}
                            {!model.hasApiKey && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t('noApiKey')}</Badge>}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title={model.canEdit ? 'Edit' : 'View'} onClick={() => onOpen(model)}>
                                {model.canEdit ? <PencilIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
                            </Button>
                            {model.canEdit && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => onDelete(model)}>
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
};
