-- CreateEnum
CREATE TYPE "CustomLanguageModelScope" AS ENUM ('PERSONAL', 'WORKSPACE');

-- CreateTable
CREATE TABLE "CustomLanguageModel" (
    "id" TEXT NOT NULL,
    "scope" "CustomLanguageModelScope" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseUrl" TEXT,
    "imageInput" BOOLEAN NOT NULL DEFAULT false,
    "temperature" DOUBLE PRECISION,
    "settings" JSONB,
    "encryptedApiKey" TEXT,
    "orgId" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomLanguageModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomLanguageModel_orgId_scope_idx" ON "CustomLanguageModel"("orgId", "scope");

-- CreateIndex
CREATE INDEX "CustomLanguageModel_createdById_idx" ON "CustomLanguageModel"("createdById");

-- AddForeignKey
ALTER TABLE "CustomLanguageModel" ADD CONSTRAINT "CustomLanguageModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomLanguageModel" ADD CONSTRAINT "CustomLanguageModel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
