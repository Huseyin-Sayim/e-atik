-- CreateEnum
CREATE TYPE "CoinRewardMode" AS ENUM ('FLAT', 'PER_KG');

-- CreateTable
CREATE TABLE "WasteType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "coinRewardMode" "CoinRewardMode" NOT NULL DEFAULT 'FLAT',
    "coinRewardValue" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "legacyEnum" "WasteCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WasteType_slug_key" ON "WasteType"("slug");
CREATE UNIQUE INDEX "WasteType_legacyEnum_key" ON "WasteType"("legacyEnum");
CREATE INDEX "WasteType_parentId_sortOrder_idx" ON "WasteType"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "WasteType" ADD CONSTRAINT "WasteType_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WasteType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed ana kategoriler
INSERT INTO "WasteType" ("id", "slug", "name", "parentId", "coinRewardMode", "coinRewardValue", "isActive", "sortOrder", "legacyEnum", "updatedAt") VALUES
('wt-parent-domestic', 'evsel-atik', 'Evsel atık', NULL, 'FLAT', 0, true, 1, 'DOMESTIC', CURRENT_TIMESTAMP),
('wt-parent-electronic', 'elektronik', 'Elektronik', NULL, 'FLAT', 0, true, 2, 'ELECTRONIC', CURRENT_TIMESTAMP),
('wt-parent-plastic', 'plastik', 'Plastik', NULL, 'FLAT', 0, true, 3, 'PLASTIC', CURRENT_TIMESTAMP),
('wt-parent-glass', 'cam', 'Cam', NULL, 'FLAT', 0, true, 4, 'GLASS', CURRENT_TIMESTAMP),
('wt-parent-paper', 'kagit', 'Kağıt', NULL, 'FLAT', 0, true, 5, 'PAPER', CURRENT_TIMESTAMP),
('wt-parent-general', 'genel', 'Genel', NULL, 'FLAT', 0, true, 6, 'GENERAL', CURRENT_TIMESTAMP);

-- Seed evsel atık çeşitleri ve diğer alt türler
INSERT INTO "WasteType" ("id", "slug", "name", "parentId", "coinRewardMode", "coinRewardValue", "isActive", "sortOrder", "legacyEnum", "updatedAt") VALUES
('wt-dom-waste-oil', 'evsel-atik-yag', 'Atık yağ', 'wt-parent-domestic', 'FLAT', 50, true, 1, NULL, CURRENT_TIMESTAMP),
('wt-dom-food', 'evsel-atik-gida', 'Gıda atığı', 'wt-parent-domestic', 'PER_KG', 8, true, 2, NULL, CURRENT_TIMESTAMP),
('wt-dom-general', 'evsel-atik-genel', 'Genel evsel', 'wt-parent-domestic', 'FLAT', 15, true, 3, NULL, CURRENT_TIMESTAMP),
('wt-elec-device', 'elektronik-cihaz', 'Elektronik cihaz', 'wt-parent-electronic', 'FLAT', 80, true, 1, NULL, CURRENT_TIMESTAMP),
('wt-elec-battery', 'elektronik-pil', 'Pil / akü', 'wt-parent-electronic', 'FLAT', 40, true, 2, NULL, CURRENT_TIMESTAMP),
('wt-plas-pet', 'plastik-pet', 'PET şişe', 'wt-parent-plastic', 'PER_KG', 12, true, 1, NULL, CURRENT_TIMESTAMP),
('wt-plas-bag', 'plastik-poset', 'Plastik poşet', 'wt-parent-plastic', 'FLAT', 5, true, 2, NULL, CURRENT_TIMESTAMP),
('wt-glass-bottle', 'cam-sise', 'Cam şişe', 'wt-parent-glass', 'PER_KG', 10, true, 1, NULL, CURRENT_TIMESTAMP),
('wt-paper-cardboard', 'kagit-karton', 'Karton', 'wt-parent-paper', 'PER_KG', 6, true, 1, NULL, CURRENT_TIMESTAMP),
('wt-paper-newspaper', 'kagit-gazete', 'Gazete / kağıt', 'wt-parent-paper', 'PER_KG', 5, true, 2, NULL, CURRENT_TIMESTAMP),
('wt-gen-mixed', 'genel-karisik', 'Karışık atık', 'wt-parent-general', 'FLAT', 10, true, 1, NULL, CURRENT_TIMESTAMP);

-- WasteRequest: add FK column
ALTER TABLE "WasteRequest" ADD COLUMN "wasteTypeId" TEXT;

-- Map existing enum values to default leaf per category
UPDATE "WasteRequest" SET "wasteTypeId" = 'wt-dom-general' WHERE "wasteType" = 'DOMESTIC';
UPDATE "WasteRequest" SET "wasteTypeId" = 'wt-elec-device' WHERE "wasteType" = 'ELECTRONIC';
UPDATE "WasteRequest" SET "wasteTypeId" = 'wt-plas-pet' WHERE "wasteType" = 'PLASTIC';
UPDATE "WasteRequest" SET "wasteTypeId" = 'wt-glass-bottle' WHERE "wasteType" = 'GLASS';
UPDATE "WasteRequest" SET "wasteTypeId" = 'wt-paper-cardboard' WHERE "wasteType" = 'PAPER';
UPDATE "WasteRequest" SET "wasteTypeId" = 'wt-gen-mixed' WHERE "wasteType" = 'GENERAL';

-- Fallback for any orphan rows
UPDATE "WasteRequest" SET "wasteTypeId" = 'wt-gen-mixed' WHERE "wasteTypeId" IS NULL;

ALTER TABLE "WasteRequest" DROP COLUMN "wasteType";
ALTER TABLE "WasteRequest" ALTER COLUMN "wasteTypeId" SET NOT NULL;

ALTER TABLE "WasteRequest" ADD CONSTRAINT "WasteRequest_wasteTypeId_fkey" FOREIGN KEY ("wasteTypeId") REFERENCES "WasteType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
