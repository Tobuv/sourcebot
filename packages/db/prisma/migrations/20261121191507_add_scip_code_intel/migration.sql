-- CreateEnum
CREATE TYPE "ScipIndexStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ScipIndex" (
    "id" TEXT NOT NULL,
    "repoId" INTEGER NOT NULL,
    "indexer" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "status" "ScipIndexStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ScipIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScipOccurrence" (
    "id" BIGSERIAL NOT NULL,
    "indexId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "roles" INTEGER NOT NULL,
    "startLine" INTEGER NOT NULL,
    "startChar" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "endChar" INTEGER NOT NULL,

    CONSTRAINT "ScipOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScipSymbol" (
    "id" BIGSERIAL NOT NULL,
    "indexId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "kind" TEXT,
    "signature" TEXT,
    "documentation" TEXT,

    CONSTRAINT "ScipSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScipIndex_repoId_status_idx" ON "ScipIndex"("repoId", "status");

-- CreateIndex
CREATE INDEX "ScipIndex_repoId_indexer_idx" ON "ScipIndex"("repoId", "indexer");

-- CreateIndex
CREATE INDEX "ScipOccurrence_indexId_filePath_startLine_idx" ON "ScipOccurrence"("indexId", "filePath", "startLine");

-- CreateIndex
CREATE INDEX "ScipOccurrence_symbol_idx" ON "ScipOccurrence"("symbol");

-- CreateIndex
CREATE INDEX "ScipSymbol_symbol_idx" ON "ScipSymbol"("symbol");

-- CreateIndex
CREATE INDEX "ScipSymbol_indexId_name_idx" ON "ScipSymbol"("indexId", "name");

-- AddForeignKey
ALTER TABLE "ScipIndex" ADD CONSTRAINT "ScipIndex_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScipOccurrence" ADD CONSTRAINT "ScipOccurrence_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "ScipIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScipSymbol" ADD CONSTRAINT "ScipSymbol_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "ScipIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
