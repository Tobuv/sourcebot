"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setMemberApprovalRequired } from "@/actions"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { useTranslations } from "next-intl";

interface MemberApprovalRequiredToggleProps {
    memberApprovalRequired: boolean
    onToggleChange?: (checked: boolean) => void
    isControlledByEnvVar: boolean
}

export function MemberApprovalRequiredToggle({ memberApprovalRequired, onToggleChange, isControlledByEnvVar }: MemberApprovalRequiredToggleProps) {
    const t = useTranslations('orgAccess');
    const [enabled, setEnabled] = useState(memberApprovalRequired)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setMemberApprovalRequired(checked)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: t('approvalFailed'),
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
            onToggleChange?.(checked)
        } catch (error) {
            console.error("Error updating member approval setting:", error)
            toast({
                title: "Error",
                description: t('approvalFailed'),
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const isDisabled = isLoading || isControlledByEnvVar;

    return (
        <div className={`p-4 rounded-lg border border-border bg-card ${isControlledByEnvVar ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground mb-2">
                        {t('approvalTitle')}
                    </h3>
                    <div className="max-w-2xl">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t('approvalDescription')}
                        </p>
                        {isControlledByEnvVar && (
                            <div className="mt-3 p-3 rounded-md bg-muted border border-border">
                                <p className="text-sm text-foreground leading-relaxed flex items-center gap-2">
                                    <svg
                                        className="w-4 h-4 flex-shrink-0 text-muted-foreground"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <span>
                                        {t.rich('controlledByEnvNotice', { code: (chunks) => <code className="bg-secondary px-1 py-0.5 rounded text-xs font-mono">{chunks}</code> })}
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <Switch
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={isDisabled}
                    />
                </div>
            </div>
        </div>
    )
} 