/*
  Warnings:

  - Made the column `name` on table `Team` required. This step will fail if there are existing NULL values in that column.
  - Made the column `password` on table `Team` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Team` ADD COLUMN `email` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `name` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `repo_url` VARCHAR(191) NULL DEFAULT '',
    MODIFY `password` VARCHAR(191) NOT NULL DEFAULT '';
