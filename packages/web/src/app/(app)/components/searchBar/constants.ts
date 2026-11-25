/**
 * A suggestion whose description is a message key in the `searchBar` namespace,
 * translated where it is rendered.
 */
export type TranslatableSuggestion = {
    value: string;
    descriptionKey:
        | 'modes.visibilityPublic' | 'modes.visibilityPrivate' | 'modes.visibilityAny'
        | 'modes.forkYes' | 'modes.forkNo' | 'modes.forkOnly'
        | 'modes.archivedYes' | 'modes.archivedNo' | 'modes.archivedOnly';
}

/**
 * List of search prefixes that can be used while the
 * `refine` suggestion mode is active.
 */
export enum SearchPrefix {
    repo = "repo:",
    r = "r:",
    lang = "lang:",
    file = "file:",
    rev = "rev:",
    revision = "revision:",
    b = "b:",
    branch = "branch:",
    sym = "sym:",
    content = "content:",
    archived = "archived:",
    fork = "fork:",
    visibility = "visibility:",
    context = "context:",
}

export const visibilityModeSuggestions: TranslatableSuggestion[] = [
    {
        value: "public",
        descriptionKey: 'modes.visibilityPublic'
    },
    {
        value: "private",
        descriptionKey: 'modes.visibilityPrivate'
    },
    {
        value: "any",
        descriptionKey: 'modes.visibilityAny'
    },
];

export const forkModeSuggestions: TranslatableSuggestion[] = [
    {
        value: "yes",
        descriptionKey: 'modes.forkYes'
    },
    {
        value: "no",
        descriptionKey: 'modes.forkNo'
    },
    {
        value: "only",
        descriptionKey: 'modes.forkOnly'
    }
];

export const archivedModeSuggestions: TranslatableSuggestion[] = [
    {
        value: "yes",
        descriptionKey: 'modes.archivedYes'
    },
    {
        value: "no",
        descriptionKey: 'modes.archivedNo'
    },
    {
        value: "only",
        descriptionKey: 'modes.archivedOnly'
    }
];

