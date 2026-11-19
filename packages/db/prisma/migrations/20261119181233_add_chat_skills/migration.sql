-- CreateEnum
CREATE TYPE "ChatSkillScope" AS ENUM ('PERSONAL', 'WORKSPACE');

-- CreateTable
CREATE TABLE "ChatSkill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "scope" "ChatSkillScope" NOT NULL,
    "autoInvoke" BOOLEAN NOT NULL DEFAULT true,
    "orgId" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSkill_orgId_scope_idx" ON "ChatSkill"("orgId", "scope");

-- CreateIndex
CREATE INDEX "ChatSkill_createdById_idx" ON "ChatSkill"("createdById");

-- AddForeignKey
ALTER TABLE "ChatSkill" ADD CONSTRAINT "ChatSkill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSkill" ADD CONSTRAINT "ChatSkill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
