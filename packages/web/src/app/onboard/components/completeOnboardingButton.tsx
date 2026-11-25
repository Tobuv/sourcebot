"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { completeOnboarding } from "@/actions"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { useTranslations } from "next-intl";

export function CompleteOnboardingButton() {
    const t = useTranslations('onboard');
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const handleCompleteOnboarding = async () => {
        setIsLoading(true)
        
        try {
            const result = await completeOnboarding()
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: t('completeFailed'),
                    variant: "destructive",
                })
                setIsLoading(false)
                return
            }
            
            router.push("/")
        } catch (error) {
            console.error("Error completing onboarding:", error)
            toast({
                title: "Error",
                description: t('completeFailed'),
                variant: "destructive",
            })
            setIsLoading(false)
        }
    }

    return (
        <Button 
            onClick={handleCompleteOnboarding}
            disabled={isLoading}
            className="w-full"
        >
            {isLoading ? t('completing') : t('complete')}
        </Button>
    )
} 