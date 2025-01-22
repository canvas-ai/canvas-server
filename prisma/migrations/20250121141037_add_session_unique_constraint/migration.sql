/*
  Warnings:

  - A unique constraint covering the columns `[user_id,name]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "sessions_user_id_name_key" ON "sessions"("user_id", "name");
