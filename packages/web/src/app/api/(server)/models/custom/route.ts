import { getCustomModelRecords, toCustomModelInfo } from "@/features/chat/customModels/customModels.server";
import { ListCustomModelsResponse } from "@/features/chat/customModels/customModelUtils";
import { getConfigFileLanguageModels } from "@/features/chat/utils.server";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";

/**
 * Lists the language models shown on the settings page: custom models visible to
 * the current user, and (read-only) the models from the config file.
 * Internal API, not part of the public API. Never returns API keys.
 */
export const GET = apiHandler(async () => {
    const result = await sew(() =>
        withAuth(async ({ org, user, role, prisma }) => {
            const records = await getCustomModelRecords({ prisma, orgId: org.id, userId: user.id });
            const configFileModels = await getConfigFileLanguageModels();

            return {
                customModels: records.map((record) => toCustomModelInfo(record, user.id, role)),
                configFileModels: configFileModels.map((model) => ({
                    provider: model.provider,
                    model: model.model,
                    displayName: model.displayName,
                    imageInput: model.imageInput ?? false,
                })),
            } satisfies ListCustomModelsResponse;
        })
    );

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
