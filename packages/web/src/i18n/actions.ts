'use server';

import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE_NAME } from './config';

/** Persists the user's language choice. */
// eslint-disable-next-line authz/require-auth-wrapper -- only sets the UI language cookie; must also work for anonymous users and touches no user data
export const setLocale = async (locale: string) => {
    if (!isLocale(locale)) {
        return;
    }

    (await cookies()).set(LOCALE_COOKIE_NAME, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
    });
}
