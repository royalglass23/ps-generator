CREATE TABLE "ps1_application_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps1_applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"resume_token_hash" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_expires_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps1_email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_address" text NOT NULL,
	"to_addresses" jsonb NOT NULL,
	"reply_to" text,
	"subject" text NOT NULL,
	"text_body" text NOT NULL,
	"html_body" text NOT NULL,
	"attempts" bigint DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error" text,
	"claimed_at" timestamp with time zone,
	"claim_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ps1_information_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"application_id" uuid NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ps1_uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"application_id" uuid NOT NULL,
	"information_request_id" uuid,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ps1_application_status_history" ADD CONSTRAINT "ps1_application_status_history_application_id_ps1_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ps1_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps1_email_outbox" ADD CONSTRAINT "ps1_email_outbox_application_id_ps1_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ps1_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps1_information_requests" ADD CONSTRAINT "ps1_information_requests_application_id_ps1_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ps1_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps1_uploads" ADD CONSTRAINT "ps1_uploads_application_id_ps1_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ps1_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ps1_uploads" ADD CONSTRAINT "ps1_uploads_information_request_id_ps1_information_requests_id_fk" FOREIGN KEY ("information_request_id") REFERENCES "public"."ps1_information_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ps1_status_history_application_idx" ON "ps1_application_status_history" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps1_applications_reference_unique" ON "ps1_applications" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ps1_applications_status_idx" ON "ps1_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ps1_applications_draft_expiry_idx" ON "ps1_applications" USING btree ("draft_expires_at");--> statement-breakpoint
CREATE INDEX "ps1_email_outbox_pending_idx" ON "ps1_email_outbox" USING btree ("available_at") WHERE "ps1_email_outbox"."sent_at" is null;--> statement-breakpoint
CREATE INDEX "ps1_information_requests_application_idx" ON "ps1_information_requests" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ps1_uploads_object_key_unique" ON "ps1_uploads" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "ps1_uploads_application_idx" ON "ps1_uploads" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "ps1_uploads_information_request_idx" ON "ps1_uploads" USING btree ("information_request_id");