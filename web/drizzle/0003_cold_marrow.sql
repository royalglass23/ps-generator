CREATE TABLE "ps1_rate_limits" (
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ps1_rate_limits_scope_key_hash_window_started_at_pk" PRIMARY KEY("scope","key_hash","window_started_at")
);
--> statement-breakpoint
CREATE INDEX "ps1_rate_limits_expiry_idx" ON "ps1_rate_limits" USING btree ("expires_at");