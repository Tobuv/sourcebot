/**
 * UI localization.
 *
 * The locale is not part of the URL. It is resolved per request from the
 * `NEXT_LOCALE` cookie (set when the user picks a language), falling back to the
 * browser's `Accept-Language` header and finally to the default locale.
 */
export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/** Name of each locale in its own language, used by the language picker. */
export const localeLabels: Record<Locale, string> = {
    en: 'English',
    zh: '简体中文',
};

export const isLocale = (value: unknown): value is Locale =>
    typeof value === 'string' && (locales as readonly string[]).includes(value);

/**
 * Picks the best supported locale from an `Accept-Language` header value,
 * e.g. "zh-CN,zh;q=0.9,en;q=0.8" -> "zh".
 */
export const matchAcceptLanguage = (header: string | null | undefined): Locale | undefined => {
    if (!header) {
        return undefined;
    }

    const candidates = header
        .split(',')
        .map((part) => {
            const [tag, ...params] = part.trim().split(';');
            const q = params.find((param) => param.trim().startsWith('q='));
            const quality = q ? Number(q.trim().slice(2)) : 1;
            return { tag: tag.trim().toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
        })
        .filter(({ tag, quality }) => tag.length > 0 && quality > 0)
        .sort((a, b) => b.quality - a.quality);

    for (const { tag } of candidates) {
        const language = tag.split('-')[0];
        if (isLocale(language)) {
            return language;
        }
    }
    return undefined;
}
