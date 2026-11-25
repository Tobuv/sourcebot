'use client';

import {
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger
} from "@/components/ui/dropdown-menu"
import { useKeymapType } from "@/hooks/useKeymapType"
import { KeymapType } from "@/lib/types"
import { setLocale } from "@/i18n/actions"
import { localeLabels, locales } from "@/i18n/config"
import {
    CodeIcon,
    LanguagesIcon,
    Laptop,
    Moon,
    Sun
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useMemo, useTransition } from "react"

export const AppearanceDropdownMenuGroup = () => {
    const { theme: _theme, setTheme } = useTheme();
    const [keymapType, setKeymapType] = useKeymapType();
    const t = useTranslations('appearance');
    const locale = useLocale();
    const router = useRouter();
    const [, startTransition] = useTransition();

    const onLocaleChange = (value: string) => {
        startTransition(async () => {
            await setLocale(value);
            router.refresh();
        });
    }

    const theme = useMemo(() => {
        return _theme ?? "light";
    }, [_theme]);

    const ThemeIcon = useMemo(() => {
        switch (theme) {
            case "light":
                return <Sun className="h-4 w-4 mr-2" />;
            case "dark":
                return <Moon className="h-4 w-4 mr-2" />;
            case "system":
                return <Laptop className="h-4 w-4 mr-2" />;
            default:
                return <Laptop className="h-4 w-4 mr-2" />;
        }
    }, [theme]);

    return (
        <DropdownMenuGroup>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    {ThemeIcon}
                    <span>{t('theme')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                            <DropdownMenuRadioItem value="light">
                                {t('light')}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dark">
                                {t('dark')}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="system">
                                {t('system')}
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <CodeIcon className="h-4 w-4 mr-2" />
                    <span>{t('codeNavigation')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={keymapType} onValueChange={(value) => setKeymapType(value as KeymapType)}>
                            <DropdownMenuRadioItem value="default">
                                {t('keymapDefault')}
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="vim">
                                {t('keymapVim')}
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <LanguagesIcon className="h-4 w-4 mr-2" />
                    <span>{t('language')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={locale} onValueChange={onLocaleChange}>
                            {locales.map((value) => (
                                <DropdownMenuRadioItem key={value} value={value}>
                                    {localeLabels[value]}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        </DropdownMenuGroup>
    )
}