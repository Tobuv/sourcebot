import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, isLocale, Locale, LOCALE_COOKIE_NAME, matchAcceptLanguage } from './config';

export const resolveLocale = async (): Promise<Locale> => {
    const cookieLocale = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
    if (isLocale(cookieLocale)) {
        return cookieLocale;
    }
    return matchAcceptLanguage((await headers()).get('accept-language')) ?? defaultLocale;
}

export default getRequestConfig(async () => {
    const locale = await resolveLocale();
    const messages = (await import(`../../messages/${locale}.json`)).default;

    return {
        locale,
        messages,
        // Keep the UI usable if a key is missing in a translation: fall back to
        // the key's path instead of throwing.
        onError: (error) => {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`[i18n] ${error.message}`);
            }
        },
        getMessageFallback: ({ namespace, key }) => [namespace, key].filter(Boolean).join('.'),
    };
});
