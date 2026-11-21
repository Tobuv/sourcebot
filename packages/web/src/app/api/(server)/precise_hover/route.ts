'use server';

import { getPreciseHover } from "@/features/preciseCodeNav/api";
import { symbolPositionSchema } from "@/features/preciseCodeNav/types";
import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to getPreciseHover() which calls withOptionalAuth
export const POST = apiHandler(async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await symbolPositionSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const response = await getPreciseHover(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
});
