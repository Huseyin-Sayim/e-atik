-- AlterTable
ALTER TABLE "WasteRequest" ADD COLUMN IF NOT EXISTS "addressLine" TEXT;
ALTER TABLE "WasteRequest" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "WasteRequest" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "WasteRequest" ADD COLUMN IF NOT EXISTS "parcelKey" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WasteRequest_status_parcelKey_idx" ON "WasteRequest"("status", "parcelKey");
CREATE INDEX IF NOT EXISTS "WasteRequest_assignedEmployeeId_idx" ON "WasteRequest"("assignedEmployeeId");
