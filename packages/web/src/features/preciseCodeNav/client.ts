import { ServiceError } from "@/lib/serviceError";
import {
    PreciseCodeNavStatusRequest,
    PreciseCodeNavStatusResponse,
    PreciseHoverResponse,
    PreciseRelatedSymbolsRequest,
    PreciseRelatedSymbolsResponse,
    SymbolPosition,
} from "./types";

const post = async <T>(url: string, body: unknown, signal?: AbortSignal): Promise<T | ServiceError> => {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
        body: JSON.stringify(body),
        signal,
    }).then((response) => response.json());
}

export const getPreciseCodeNavStatus = (body: PreciseCodeNavStatusRequest) =>
    post<PreciseCodeNavStatusResponse>("/api/precise_status", body);

export const getPreciseHover = (body: SymbolPosition, signal?: AbortSignal) =>
    post<PreciseHoverResponse>("/api/precise_hover", body, signal);

export const findPreciseRelatedSymbols = (body: PreciseRelatedSymbolsRequest) =>
    post<PreciseRelatedSymbolsResponse | null>("/api/precise_related", body);
