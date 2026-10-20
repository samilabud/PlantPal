CREATE TYPE "public"."ai_report_reason" AS ENUM('wrong', 'offensive', 'other');--> statement-breakpoint
CREATE TYPE "public"."ai_status" AS ENUM('pending', 'ok', 'low_confidence', 'not_plant', 'invalid_output', 'refused', 'timeout', 'error');--> statement-breakpoint
CREATE TABLE "ai_identifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model" text NOT NULL,
	"status" "ai_status" DEFAULT 'pending' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micro_usd" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" "ai_report_reason" NOT NULL,
	"note" text,
	"suggestion" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_identifications" ADD CONSTRAINT "ai_identifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_identification_id_ai_identifications_id_fk" FOREIGN KEY ("identification_id") REFERENCES "public"."ai_identifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_identifications_user_id_created_at_index" ON "ai_identifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_identifications_created_at_index" ON "ai_identifications" USING btree ("created_at");