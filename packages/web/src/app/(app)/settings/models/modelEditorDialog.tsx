'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createCustomModel, testCustomModel, TestCustomModelResult, updateCustomModel } from "@/features/chat/customModels/actions";
import {
    CUSTOM_MODEL_PROVIDER_INFO,
    CUSTOM_MODEL_PROVIDERS,
    CustomModelInfo,
    CustomModelInput,
    customModelInputSchema,
    CustomModelProvider,
} from "@/features/chat/customModels/customModelUtils";
import { cn, isServiceError } from "@/lib/utils";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

export type ModelEditorState =
    | { mode: 'create' }
    | { mode: 'edit', model: CustomModelInfo }
    | { mode: 'view', model: CustomModelInfo };

interface ModelEditorDialogProps {
    state: ModelEditorState | null;
    isOwner: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

type FormValues = {
    scope: CustomModelInput['scope'];
    provider: CustomModelProvider;
    model: string;
    displayName: string;
    baseUrl: string;
    apiKey: string;
    removeApiKey: boolean;
    imageInput: boolean;
    temperature: string;
    authType: 'api-key' | 'bearer';
    resourceName: string;
    apiVersion: string;
    reasoningTag: string;
};

const getInitialValues = (state: ModelEditorState | null, isOwner: boolean): FormValues => {
    const model = state && state.mode !== 'create' ? state.model : undefined;
    return {
        scope: model?.scope ?? (isOwner ? 'WORKSPACE' : 'PERSONAL'),
        provider: model?.provider ?? 'anthropic',
        model: model?.model ?? '',
        displayName: model?.displayName ?? '',
        baseUrl: model?.baseUrl ?? '',
        apiKey: '',
        removeApiKey: false,
        imageInput: model?.imageInput ?? false,
        temperature: model?.temperature !== undefined ? String(model.temperature) : '',
        authType: model?.settings.authType ?? 'api-key',
        resourceName: model?.settings.resourceName ?? '',
        apiVersion: model?.settings.apiVersion ?? '',
        reasoningTag: model?.settings.reasoningTag ?? '',
    };
}

const toInput = (values: FormValues, isEdit: boolean): CustomModelInput => ({
    scope: values.scope,
    provider: values.provider,
    model: values.model,
    displayName: values.displayName,
    baseUrl: values.baseUrl,
    // When editing, a blank field keeps the saved key.
    apiKey: values.removeApiKey ? '' : (values.apiKey.trim() ? values.apiKey : (isEdit ? undefined : '')),
    imageInput: values.imageInput,
    temperature: values.temperature.trim() ? Number(values.temperature) : undefined,
    settings: {
        ...(values.provider === 'anthropic' ? { authType: values.authType } : {}),
        ...(values.provider === 'azure' ? { resourceName: values.resourceName || undefined, apiVersion: values.apiVersion || undefined } : {}),
        ...(values.provider === 'openai-compatible' ? { reasoningTag: values.reasoningTag || undefined } : {}),
    },
});

/**
 * Note: render with a `key` that changes per opened model so the form state resets.
 */
export const ModelEditorDialog = ({ state, isOwner, onOpenChange, onSaved }: ModelEditorDialogProps) => {
    const { toast } = useToast();
    const [values, setValues] = useState<FormValues>(() => getInitialValues(state, isOwner));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestCustomModelResult | null>(null);

    const isEdit = state?.mode === 'edit';
    const isReadOnly = state?.mode === 'view';
    const existing = state && state.mode !== 'create' ? state.model : undefined;
    const providerInfo = CUSTOM_MODEL_PROVIDER_INFO[values.provider];

    const update = (patch: Partial<FormValues>) => {
        setValues((prev) => ({ ...prev, ...patch }));
        setTestResult(null);
    };

    const validate = (): CustomModelInput | undefined => {
        const input = toInput(values, isEdit);
        if (values.temperature.trim() && Number.isNaN(Number(values.temperature))) {
            setErrors({ temperature: 'Temperature must be a number.' });
            return undefined;
        }
        const parsed = customModelInputSchema.safeParse(input);
        if (!parsed.success) {
            const fieldErrors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const field = String(issue.path[issue.path.length - 1]);
                fieldErrors[field] ??= issue.message;
            }
            setErrors(fieldErrors);
            return undefined;
        }
        setErrors({});
        return input;
    };

    const onTest = async () => {
        const input = validate();
        if (!input) {
            return;
        }
        setIsTesting(true);
        setTestResult(null);
        const result = await testCustomModel(input, existing?.id);
        setIsTesting(false);
        if (isServiceError(result)) {
            setTestResult({ success: false, message: result.message });
            return;
        }
        setTestResult(result);
    };

    const onSave = async () => {
        const input = validate();
        if (!input || !state || isReadOnly) {
            return;
        }
        setIsSaving(true);
        const result = isEdit && existing
            ? await updateCustomModel(existing.id, input)
            : await createCustomModel(input);
        setIsSaving(false);

        if (isServiceError(result)) {
            toast({ description: `❌ ${result.message}`, variant: "destructive" });
            return;
        }
        toast({ description: `✅ Saved model "${result.displayName}"` });
        onSaved();
    };

    const fieldError = (name: string) => errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>;

    return (
        <Dialog open={state !== null} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{state?.mode === 'create' ? 'Add model' : isEdit ? 'Edit model' : 'View model'}</DialogTitle>
                    <DialogDescription>
                        Models added here appear in the model selector of Ask NexusCode. API keys are encrypted and never shown again after saving.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 overflow-y-auto px-1 -mx-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Provider</Label>
                            <Select
                                value={values.provider}
                                disabled={isReadOnly}
                                onValueChange={(provider) => update({ provider: provider as CustomModelProvider })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CUSTOM_MODEL_PROVIDERS.map((provider) => (
                                        <SelectItem key={provider} value={provider}>{CUSTOM_MODEL_PROVIDER_INFO[provider].label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Available to</Label>
                            <Select
                                value={values.scope}
                                disabled={isReadOnly}
                                onValueChange={(scope) => update({ scope: scope as FormValues['scope'] })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="WORKSPACE" disabled={!isOwner}>
                                        All members{!isOwner ? ' · owners only' : ''}
                                    </SelectItem>
                                    <SelectItem value="PERSONAL">Only me</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="model-display-name">Display name</Label>
                            <Input
                                id="model-display-name"
                                value={values.displayName}
                                placeholder="Claude Sonnet"
                                disabled={isReadOnly}
                                onChange={(event) => update({ displayName: event.target.value })}
                            />
                            {fieldError('displayName')}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="model-id">Model ID</Label>
                            <Input
                                id="model-id"
                                value={values.model}
                                placeholder={providerInfo.modelPlaceholder}
                                className="font-mono"
                                disabled={isReadOnly}
                                onChange={(event) => update({ model: event.target.value })}
                            />
                            {fieldError('model')}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="model-base-url">
                            Base URL{!providerInfo.baseUrlRequired && <span className="text-muted-foreground font-normal"> (optional)</span>}
                        </Label>
                        <Input
                            id="model-base-url"
                            value={values.baseUrl}
                            placeholder={providerInfo.baseUrlPlaceholder ?? 'Use the provider default'}
                            className="font-mono"
                            disabled={isReadOnly}
                            onChange={(event) => update({ baseUrl: event.target.value })}
                        />
                        {fieldError('baseUrl')}
                    </div>

                    {!isReadOnly && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="model-api-key">API key</Label>
                            <Input
                                id="model-api-key"
                                type="password"
                                autoComplete="off"
                                value={values.apiKey}
                                disabled={values.removeApiKey}
                                placeholder={existing?.hasApiKey
                                    ? `Saved${existing.apiKeyHint ? ` (…${existing.apiKeyHint})` : ''}. Leave blank to keep it.`
                                    : providerInfo.apiKeyEnvVar ? `Leave blank to use ${providerInfo.apiKeyEnvVar}` : 'Optional'}
                                onChange={(event) => update({ apiKey: event.target.value })}
                            />
                            {existing?.hasApiKey && (
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Checkbox
                                        checked={values.removeApiKey}
                                        onCheckedChange={(checked) => update({ removeApiKey: checked === true, apiKey: '' })}
                                    />
                                    Remove the saved API key
                                </label>
                            )}
                            {fieldError('apiKey')}
                        </div>
                    )}

                    {values.provider === 'anthropic' && (
                        <div className="flex flex-col gap-1.5">
                            <Label>Send the API key as</Label>
                            <Select
                                value={values.authType}
                                disabled={isReadOnly}
                                onValueChange={(authType) => update({ authType: authType as FormValues['authType'] })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="api-key">x-api-key header (Anthropic API)</SelectItem>
                                    <SelectItem value="bearer">Authorization: Bearer (compatible gateways)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {values.provider === 'azure' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="model-resource-name">Resource name</Label>
                                <Input
                                    id="model-resource-name"
                                    value={values.resourceName}
                                    disabled={isReadOnly}
                                    onChange={(event) => update({ resourceName: event.target.value })}
                                />
                                {fieldError('resourceName')}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="model-api-version">API version <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                <Input
                                    id="model-api-version"
                                    value={values.apiVersion}
                                    disabled={isReadOnly}
                                    onChange={(event) => update({ apiVersion: event.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {values.provider === 'openai-compatible' && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="model-reasoning-tag">Reasoning tag <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                                id="model-reasoning-tag"
                                value={values.reasoningTag}
                                placeholder="think"
                                className="font-mono"
                                disabled={isReadOnly}
                                onChange={(event) => update({ reasoningTag: event.target.value })}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                            <div className="flex flex-col gap-0.5">
                                <Label htmlFor="model-image-input">Image input</Label>
                                <span className="text-xs text-muted-foreground">The model accepts images.</span>
                            </div>
                            <Switch
                                id="model-image-input"
                                checked={values.imageInput}
                                disabled={isReadOnly}
                                onCheckedChange={(imageInput) => update({ imageInput })}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="model-temperature">Temperature <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                                id="model-temperature"
                                inputMode="decimal"
                                value={values.temperature}
                                placeholder="Model default"
                                disabled={isReadOnly}
                                onChange={(event) => update({ temperature: event.target.value })}
                            />
                            {fieldError('temperature')}
                        </div>
                    </div>

                    {testResult && (
                        <div className={cn(
                            "flex items-start gap-2 rounded-md border p-3 text-xs",
                            testResult.success ? "border-green-600/40" : "border-destructive/50 text-destructive",
                        )}>
                            {testResult.success
                                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
                                : <XCircle className="w-4 h-4 flex-shrink-0" />}
                            <span className="break-all">
                                {testResult.success
                                    ? `Connected in ${(testResult.latencyMs / 1000).toFixed(1)}s. Response: "${testResult.response}"`
                                    : testResult.message}
                            </span>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {!isReadOnly && (
                        <Button variant="outline" onClick={onTest} disabled={isTesting} className="sm:mr-auto">
                            {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Test connection
                        </Button>
                    )}
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
