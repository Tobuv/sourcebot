import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";

export function Footer() {
    const t = useTranslations('footer');
    return (
        <footer className="w-full mt-auto py-4 flex flex-row justify-center items-center gap-4">
        <Link href="https://sourcebot.dev" className="text-gray-400 text-sm hover:underline">{t('about')}</Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="https://docs.sourcebot.dev" className="text-gray-400 text-sm hover:underline">{t('docs')}</Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="https://sourcebot.dev/security" className="text-gray-400 text-sm hover:underline">{t('security')}</Link>
    </footer>
    )
}