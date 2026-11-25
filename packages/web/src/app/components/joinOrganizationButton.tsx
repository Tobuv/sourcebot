"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { joinOrganization } from "../invite/actions";
import { isServiceError } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function JoinOrganizationButton({ inviteLinkId }: { inviteLinkId?: string }) {
    const t = useTranslations('orgAccess');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleJoinOrganization = async () => {
        setIsLoading(true);
        
        try {
            const result = await joinOrganization(inviteLinkId);
            
            if (isServiceError(result)) {
                toast({
                    title: t('joinFailed'),
                    description: result.message,
                    variant: "destructive",
                });
                return;
            }

            router.refresh();
        } catch (error) {
            console.error("Error joining organization:", error);
            toast({
                title: t('error'),
                description: t('unexpectedError'),
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button 
            onClick={handleJoinOrganization}
            disabled={isLoading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-[var(--primary-foreground)] transition-all duration-200 font-medium"
        >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('joinOrganization')}
        </Button>
    );
} 