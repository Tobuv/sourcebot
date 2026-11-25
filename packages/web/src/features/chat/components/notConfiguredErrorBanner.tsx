import { TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const DOCS_URL = "https://docs.sourcebot.dev/docs/configuration/language-model-providers"; 

interface NotConfiguredErrorBannerProps {
    className?: string;
}

export const NotConfiguredErrorBanner = ({ className }: NotConfiguredErrorBannerProps) => {
    const t = useTranslations('chatBox');
    return (
        <div className={cn("flex flex-row items-center bg-error rounded-md p-2", className)}>
            <TriangleAlertIcon className="h-4 w-4 text-accent mr-1.5" />
            <span className="text-sm font-medium text-accent">{t.rich('notConfigured', { b: (chunks) => <span className="font-bold">{chunks}</span>, link: (chunks) => <Link href={DOCS_URL} target="_blank" className="underline">{chunks}</Link> })}</span>
        </div>
    )
}