"use client"

import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/hooks/use-toast"
import { createAccountRequest } from "@/actions"
import { isServiceError } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl";


export function SubmitAccountRequestButton() {
    const t = useTranslations('shared');
    const tCommon = useTranslations('common');
    const { toast } = useToast()
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        setIsSubmitting(true)
        const result = await createAccountRequest()
        if (!isServiceError(result)) {
            if (result.existingRequest) {
                toast({
                    title: t('requestAlreadySubmitted'),
                    description: t('requestAlreadySubmittedDescription'),
                    variant: "default",
                })
            } else {
                toast({
                    title: t('requestSubmitted'),
                    description: t('requestSubmittedDescription'),
                    variant: "default",
                })
            }
            // Refresh the page to trigger layout re-render and show PendingApprovalCard
            router.refresh()
        } else {
            toast({
                title: t('failedToSubmit'),
                description: t('failedToSubmitDescription', { reason: result.message }),
                variant: "destructive",
            })
        }
        setIsSubmitting(false)
    }

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
        }}>
            <Button
                type="submit"
                className="flex items-center gap-2"
                variant="outline"
                disabled={isSubmitting}
            >
                <Clock className="h-4 w-4" />
                {isSubmitting ? tCommon('submitting') : t('submitRequest')}
            </Button>
        </form>
    )
} 