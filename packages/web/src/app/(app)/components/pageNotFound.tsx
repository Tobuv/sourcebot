import { NotFound } from "./notFound"

import { useTranslations } from "next-intl";
export const PageNotFound = () => {
    const t = useTranslations('common');
    return (
        <div className="flex h-screen">
            <NotFound message={t('pageNotFound')} />
        </div>
    )
}