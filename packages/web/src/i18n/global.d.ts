import type { Locale } from './config';
import type messages from '../../messages/en.json';

// Makes `useTranslations` / `getTranslations` type safe: unknown keys and
// missing interpolation arguments are compile errors.
// @see https://next-intl.dev/docs/workflows/typescript
declare module 'next-intl' {
    interface AppConfig {
        Locale: Locale;
        Messages: typeof messages;
    }
}
