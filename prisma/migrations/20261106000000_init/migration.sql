-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT,
    "label" TEXT,
    "collectionId" TEXT,
    "webhookSubscriptionId" TEXT,
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountGroup" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "singleItem" BOOLEAN NOT NULL DEFAULT false,
    "excludedTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimumOrderAmount" DOUBLE PRECISION,
    "usageLimit" INTEGER DEFAULT 1,
    "appliesOncePerCustomer" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "customerSelection" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopDiscount" (
    "id" TEXT NOT NULL,
    "discountGroupId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyDiscountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "discountGroupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedOnShopId" TEXT,
    "redeemedOrderId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeRemovalJob" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "shopDiscountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeRemovalJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopDiscount_discountGroupId_shopId_key" ON "ShopDiscount"("discountGroupId", "shopId");

-- CreateIndex
CREATE INDEX "DiscountCode_code_idx" ON "DiscountCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_discountGroupId_code_key" ON "DiscountCode"("discountGroupId", "code");

-- CreateIndex
CREATE INDEX "CodeRemovalJob_status_idx" ON "CodeRemovalJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CodeRemovalJob_discountCodeId_shopDiscountId_key" ON "CodeRemovalJob"("discountCodeId", "shopDiscountId");

-- AddForeignKey
ALTER TABLE "ShopDiscount" ADD CONSTRAINT "ShopDiscount_discountGroupId_fkey" FOREIGN KEY ("discountGroupId") REFERENCES "DiscountGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDiscount" ADD CONSTRAINT "ShopDiscount_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_discountGroupId_fkey" FOREIGN KEY ("discountGroupId") REFERENCES "DiscountGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRemovalJob" ADD CONSTRAINT "CodeRemovalJob_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRemovalJob" ADD CONSTRAINT "CodeRemovalJob_shopDiscountId_fkey" FOREIGN KEY ("shopDiscountId") REFERENCES "ShopDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

