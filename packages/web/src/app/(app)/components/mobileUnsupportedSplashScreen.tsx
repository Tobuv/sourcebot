'use client';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect } from "react";
import { dismissMobileUnsupportedSplashScreen } from "@/actions";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useTranslations } from "next-intl";

export const MobileUnsupportedSplashScreen = () => {
    const t = useTranslations('shared');
    const tCommon = useTranslations('common');
    const captureEvent = useCaptureEvent();

    useEffect(() => {
        captureEvent('wa_mobile_unsupported_splash_screen_displayed', {});
    }, [captureEvent]);

    const onDismissed = useCallback(() => {
        dismissMobileUnsupportedSplashScreen();
        captureEvent('wa_mobile_unsupported_splash_screen_dismissed', {});
    }, [captureEvent]);

    return (
        <div className="flex flex-col items-center justify-center p-2 min-h-screen bg-backgroundSecondary">
            <Card className="flex flex-col items-center text-center mb-10 p-4 max-w-sm">
                <TriangleAlert className="w-10 h-10 mb-4 text-yellow-600/90 dark:text-yellow-300/90" />
                <div className="text-2xl font-semibold flex items-center mb-2">
                    {t('mobileUnsupported')}
                </div>
                <p className="text-sm text-muted-foreground mb-8">
                    {t('mobileUnsupportedDescription')}
                </p>
                    <Button
                        className="w-full"
                        variant="outline"
                        onClick={onDismissed}
                    >
                        {tCommon('continueAnyway')}
                    </Button>
            </Card>
        </div>
    )
}