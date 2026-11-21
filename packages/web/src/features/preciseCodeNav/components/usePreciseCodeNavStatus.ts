'use client';

import { isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getPreciseCodeNavStatus } from "../client";

/**
 * Returns whether a precise (SCIP) index is available for the given revision.
 */
export const usePreciseCodeNavStatus = (repoName: string, revisionName?: string) => {
    const { data } = useQuery({
        queryKey: ['precise-code-nav-status', repoName, revisionName],
        queryFn: async () => {
            const response = await getPreciseCodeNavStatus({ repoName, revisionName });
            if (isServiceError(response)) {
                return { available: false, indexes: [] };
            }
            return response;
        },
        staleTime: 60 * 1000,
    });

    return {
        isAvailable: data?.available ?? false,
        status: data,
    };
}
