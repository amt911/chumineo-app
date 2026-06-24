/*
  Warnings:

  - The `condition` column on the `UserInventory` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('MINT', 'NEAR_MINT', 'GOOD', 'PLAYED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "WishlistPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "UserInventory" DROP COLUMN "condition",
ADD COLUMN     "condition" "Condition";

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "priority" "WishlistPriority" NOT NULL DEFAULT 'MEDIUM',
    "maxPrice" DECIMAL(12,2),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_collectionItemId_key" ON "WishlistItem"("userId", "collectionItemId");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
