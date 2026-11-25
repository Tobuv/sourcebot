import type { Locale as DateFnsLocale } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { useLocale } from "next-intl";
import type { Locale } from "./config";

const dateFnsLocales: Record<Locale, DateFnsLocale> = {
    en: enUS,
    zh: zhCN,
};

export const getDateFnsLocale = (locale: Locale): DateFnsLocale => dateFnsLocales[locale];

/** date-fns locale for the current UI language (for `format`, `formatDistance`, ...). */
export const useDateFnsLocale = (): DateFnsLocale => getDateFnsLocale(useLocale());

/** BCP 47 tag for `Intl` APIs (e.g. `Intl.DateTimeFormat`). */
export const getIntlLocale = (locale: Locale): string => locale === 'zh' ? 'zh-CN' : 'en-US';
