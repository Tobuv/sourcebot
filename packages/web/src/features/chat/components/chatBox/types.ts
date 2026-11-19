
export type SuggestionMode = 
    "none" |
    "refine" |
    "file" |
    "skill"
;

export type RefineSuggestion = {
    type: 'refine';
    targetSuggestionMode: Exclude<SuggestionMode, 'none' | 'refine' | 'skill'>;
    name: string;
    description: string;
}

export type FileSuggestion = {
    type: 'file';
    repo: string;
    path: string;
    name: string;
    language: string;
    revision: string;
}

export type SkillSuggestion = {
    type: 'skill';
    id: string;
    name: string;
    description: string;
    scope: 'PERSONAL' | 'WORKSPACE';
}

export type Suggestion = FileSuggestion | RefineSuggestion | SkillSuggestion;
