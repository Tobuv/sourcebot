'use client';

import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { z } from "zod";

/**
 * Localizes zod's default validation messages (used by forms through
 * `zodResolver`) for non-English locales. Messages that schemas define
 * explicitly are left untouched.
 *
 * The error map is global, so this only runs in the browser.
 */
export const ZodErrorMapProvider = () => {
    const locale = useLocale();
    const t = useTranslations('validation');

    useEffect(() => {
        if (locale === 'en') {
            z.setErrorMap(z.defaultErrorMap);
            return;
        }

        const errorMap: z.ZodErrorMap = (issue, ctx) => {
            switch (issue.code) {
                case z.ZodIssueCode.invalid_type:
                    if (issue.received === 'undefined' || issue.received === 'null') {
                        return { message: t('required') };
                    }
                    return { message: t('invalidType') };
                case z.ZodIssueCode.too_small: {
                    const min = Number(issue.minimum);
                    if (issue.type === 'string') {
                        return { message: min <= 1 ? t('required') : t('stringTooShort', { min }) };
                    }
                    if (issue.type === 'array') {
                        return { message: t('arrayTooShort', { min }) };
                    }
                    if (issue.type === 'number' || issue.type === 'bigint') {
                        return { message: t('numberTooSmall', { min }) };
                    }
                    break;
                }
                case z.ZodIssueCode.too_big: {
                    const max = Number(issue.maximum);
                    if (issue.type === 'string') {
                        return { message: t('stringTooLong', { max }) };
                    }
                    if (issue.type === 'array') {
                        return { message: t('arrayTooLong', { max }) };
                    }
                    if (issue.type === 'number' || issue.type === 'bigint') {
                        return { message: t('numberTooBig', { max }) };
                    }
                    break;
                }
                case z.ZodIssueCode.invalid_string:
                    if (issue.validation === 'email') {
                        return { message: t('invalidEmail') };
                    }
                    if (issue.validation === 'url') {
                        return { message: t('invalidUrl') };
                    }
                    return { message: t('invalidFormat') };
            }
            return { message: ctx.defaultError };
        };

        z.setErrorMap(errorMap);
        return () => {
            z.setErrorMap(z.defaultErrorMap);
        };
    }, [locale, t]);

    return null;
}
