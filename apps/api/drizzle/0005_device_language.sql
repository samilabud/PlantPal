CREATE TYPE "public"."app_language" AS ENUM('en', 'es');--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "language" "app_language" DEFAULT 'en' NOT NULL;