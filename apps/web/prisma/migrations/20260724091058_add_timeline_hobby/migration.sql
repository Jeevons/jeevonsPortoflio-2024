-- CreateTable
CREATE TABLE "TimelineEntry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "avatarId" TEXT,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hobby" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "posLeft" TEXT NOT NULL,
    "posTop" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Hobby_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEntry_slug_key" ON "TimelineEntry"("slug");

-- CreateIndex
CREATE INDEX "TimelineEntry_published_sortOrder_idx" ON "TimelineEntry"("published", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Hobby_slug_key" ON "Hobby"("slug");
