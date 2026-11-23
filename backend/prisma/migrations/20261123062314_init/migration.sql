-- CreateTable
CREATE TABLE "Partner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "annualBudget" REAL NOT NULL DEFAULT 25000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "partnerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignKit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "prepTime" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "assets" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "KitCustomisation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kitId" INTEGER NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "company" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KitCustomisation_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "CampaignKit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KitCustomisation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningModule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "checks" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "hint" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "LearningProgress" (
    "userId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "moduleId"),
    CONSTRAINT "LearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "LearningModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FundingRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "kitId" INTEGER,
    "title" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "eligibleCost" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "feedback" TEXT,
    "submittedBy" INTEGER,
    "decidedBy" INTEGER,
    "submittedAt" DATETIME,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FundingRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FundingRequest_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "CampaignKit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fundingId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "metrics" TEXT,
    "actualSpend" REAL,
    "assetStatus" TEXT NOT NULL DEFAULT 'Draft',
    "assetVersion" INTEGER NOT NULL DEFAULT 1,
    "assetNote" TEXT,
    "assetBy" INTEGER,
    CONSTRAINT "Campaign_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "FundingRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storedAs" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignFile_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "amount" REAL,
    "attested" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "note" TEXT,
    "submittedBy" INTEGER,
    "decidedBy" INTEGER,
    "submittedAt" DATETIME,
    "decidedAt" DATETIME,
    "paymentRef" TEXT,
    "paidAt" TEXT,
    "paidBy" INTEGER,
    CONSTRAINT "Claim_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenefitItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "limitText" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BenefitRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partnerId" INTEGER NOT NULL,
    "benefitId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BenefitRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BenefitRequest_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "BenefitItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cost" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "PointsEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partnerId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "rewardId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PointsEntry_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_code_key" ON "Partner"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignKit_slug_key" ON "CampaignKit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "KitCustomisation_kitId_partnerId_key" ON "KitCustomisation"("kitId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRequest_code_key" ON "FundingRequest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_fundingId_key" ON "Campaign"("fundingId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_code_key" ON "Claim"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_campaignId_key" ON "Claim"("campaignId");
