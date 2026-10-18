-- AlterTable
ALTER TABLE "Message" ADD COLUMN "waId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_waId_key" ON "Message"("waId");

