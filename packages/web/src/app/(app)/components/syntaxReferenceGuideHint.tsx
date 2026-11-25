'use client';

import { useSyntaxGuide } from "./syntaxGuideProvider";
import { KeyboardShortcutHint } from "../../components/keyboardShortcutHint";
import { useTranslations } from "next-intl";

export const SyntaxReferenceGuideHint = () => {
    const t = useTranslations('syntaxGuide');
    const { isOpen, onOpenChanged } = useSyntaxGuide();

    return (
        <div
            className="text-sm cursor-pointer"
            onClick={() => onOpenChanged(!isOpen)}
        >
            <span className="dark:text-gray-300">{t('hint')}</span><KeyboardShortcutHint shortcut="mod" /> <KeyboardShortcutHint shortcut="/" />
        </div>
    )
}