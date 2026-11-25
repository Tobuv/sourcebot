import type { Commit, CommitAuthor } from "@/features/git";

export type Author = { name: string; email: string };

export const parseCoAuthors = (body: string): Author[] => {
    const coAuthors: Author[] = [];
    const regex = /^co-authored-by:\s*(.+?)\s*<(.+?)>\s*$/gim;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
        coAuthors.push({ name: match[1].trim(), email: match[2].trim() });
    }
    return coAuthors;
};

export const getCommitAuthors = (commit: Commit): Author[] => {
    const all: Author[] = [
        { name: commit.authorName, email: commit.authorEmail },
        ...parseCoAuthors(commit.body),
    ];
    const seen = new Set<string>();
    return all.filter((a) => {
        const key = a.email.toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

/**
 * Collapses rows with the same lowercased email into a single entry.
 * git shortlog groups by full author string (name + email), so one person
 * who committed under multiple name spellings appears as multiple rows.
 * The canonical name picked is the one with the most commits; counts are
 * summed. Result is resorted by commitCount descending.
 */
export const dedupeCommitAuthorsByEmail = (authors: CommitAuthor[]): CommitAuthor[] => {
    type Accum = CommitAuthor & { bestNameCount: number };
    const byEmail = new Map<string, Accum>();
    for (const a of authors) {
        const key = a.email.toLowerCase();
        const existing = byEmail.get(key);
        if (!existing) {
            byEmail.set(key, { ...a, bestNameCount: a.commitCount });
        } else {
            existing.commitCount += a.commitCount;
            if (a.commitCount > existing.bestNameCount) {
                existing.name = a.name;
                existing.email = a.email;
                existing.bestNameCount = a.commitCount;
            }
        }
    }
    return Array.from(byEmail.values())
        .map(({ name, email, commitCount }) => ({ name, email, commitCount }))
        .sort((a, b) => b.commitCount - a.commitCount);
};

/**
 * Escapes a literal string so it matches verbatim under git's default regex
 * (POSIX BRE with GNU extensions, used by `git log --author` and `--grep`).
 *
 * BRE treats `. [ ] ^ $ *` as metacharacters; `+ ? | ( ) { }` are literal
 * in BRE (their `\` forms are the GNU extensions with meta meaning), so we
 * do NOT escape them here.
 */
export const escapeGitBreLiteral = (s: string): string =>
    s.replace(/[.[\]^$*\\]/g, '\\$&');

/** Translated templates for joining author names (see `browse.authorsTwo` / `browse.authorsMany`). */
export type AuthorsTextFormat = {
    two: (first: string, second: string) => string;
    many: (first: string, second: string, others: number) => string;
};

const defaultAuthorsTextFormat: AuthorsTextFormat = {
    two: (first, second) => `${first} and ${second}`,
    many: (first, second, others) => `${first}, ${second}, and ${others} other${others > 1 ? "s" : ""}`,
};

export const formatAuthorsText = (authors: Author[], format: AuthorsTextFormat = defaultAuthorsTextFormat): string => {
    if (authors.length === 1) {
        return authors[0].name;
    }
    if (authors.length === 2) {
        return format.two(authors[0].name, authors[1].name);
    }
    return format.many(authors[0].name, authors[1].name, authors.length - 2);
};

/** Builds an `AuthorsTextFormat` from a translator scoped to the `browse` namespace. */
export const authorsTextFormatFromTranslator = (
    t: (key: 'authorsTwo' | 'authorsMany', values: { first: string; second: string; others?: number }) => string,
): AuthorsTextFormat => ({
    two: (first, second) => t('authorsTwo', { first, second }),
    many: (first, second, others) => t('authorsMany', { first, second, others }),
});
