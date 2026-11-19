'use client';

import { useQuery } from "@tanstack/react-query";
import { FileSuggestion, RefineSuggestion, SkillSuggestion, Suggestion, SuggestionMode } from "./types";
import { unwrapServiceError } from "@/lib/utils";
import { listSkills, search } from "@/app/api/(client)/client";
import { useMemo } from "react";

interface Props {
    suggestionMode: SuggestionMode;
    suggestionQuery: string;
    selectedRepos: string[];
}

const refineSuggestions: RefineSuggestion[] = [
    {
        type: 'refine',
        targetSuggestionMode: 'file',
        name: 'Files',
        description: 'Include a file in the agent\'s context window.',
    }
]

export const useSuggestionsData = ({
    suggestionMode,
    suggestionQuery,
    selectedRepos,
}: Props): { isLoading: boolean, suggestions: Suggestion[] } => {
    const { data: fileSuggestions, isLoading: _isLoadingFileSuggestions } = useQuery({
        queryKey: ["fileSuggestions-agentic", suggestionQuery, selectedRepos],
        queryFn: () => {
            const query = [];
            if (suggestionQuery.length > 0) {
                query.push(`file:${suggestionQuery}`);
            } else {
                query.push('file:.*');
            }

            if (selectedRepos.length > 0) {
                query.push(`reposet:${selectedRepos.join(',')}`);
            }

            return unwrapServiceError(search({
                query: query.join(' '),
                matches: 10,
                contextLines: 1,
            }))
        },
        select: (data): FileSuggestion[] => {
            return data.files.map((file) => {
                const path = file.fileName.text;
                const suggestion: FileSuggestion = {
                    type: 'file',
                    path,
                    repo: file.repository,
                    name: path.split('/').pop() ?? '',
                    language: file.language,
                    revision: 'HEAD', // @todo: make revision configurable.
                }

                return suggestion;
            });
        },
        enabled: suggestionMode === "file",
    });
    const { data: allSkillSuggestions, isLoading: _isLoadingSkills } = useQuery({
        queryKey: ["chatSkills"],
        queryFn: () => unwrapServiceError(listSkills()),
        select: (data): SkillSuggestion[] => data.filter((skill) => !skill.isShadowed).map((skill) => ({
            type: 'skill',
            id: skill.id,
            name: skill.name,
            description: skill.description,
            scope: skill.scope,
        })),
        enabled: suggestionMode === "skill",
    });
    const skillSuggestions = useMemo(() => {
        const query = suggestionQuery.toLowerCase();
        const skills = allSkillSuggestions ?? [];
        // Prefix matches first, then other substring matches.
        return [
            ...skills.filter((skill) => skill.name.startsWith(query)),
            ...skills.filter((skill) => !skill.name.startsWith(query) && skill.name.includes(query)),
        ].slice(0, 10);
    }, [allSkillSuggestions, suggestionQuery]);
    const isLoadingSkills = suggestionMode === "skill" && _isLoadingSkills;

    const isLoadingFiles = useMemo(() => suggestionMode === "file" && _isLoadingFileSuggestions, [_isLoadingFileSuggestions, suggestionMode]);

    switch (suggestionMode) {
        case 'file':
            return {
                suggestions: fileSuggestions ?? [],
                isLoading: isLoadingFiles,
            }
        case 'skill':
            return {
                suggestions: skillSuggestions,
                isLoading: isLoadingSkills,
            }
        case 'refine':
            return {
                suggestions: refineSuggestions,
                isLoading: false,
            }
        default:
            return {
                isLoading: false,
                suggestions: [],
            }
    }
}