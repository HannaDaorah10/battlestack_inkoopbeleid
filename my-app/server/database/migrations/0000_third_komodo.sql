CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"model_config_key" text DEFAULT 'chat' NOT NULL,
	"prompt_key" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_model_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_configs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "totp_secrets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_secret" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"enabled_at" timestamp,
	"setup_expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webauthn_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"device_type" text,
	"backed_up" text,
	"transports" text,
	"label" text,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"bucket" text NOT NULL,
	"key" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"mime" text,
	"etag" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"role_name" text NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"ceiling_amount_cents" bigint DEFAULT 0 NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mandates_ceiling_non_negative" CHECK ("mandates"."ceiling_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"period_start" date,
	"period_end" date,
	"status" text DEFAULT 'analyse' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"content_markdown" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_chapters_policy_id_number_key" UNIQUE("policy_id","number"),
	CONSTRAINT "policy_chapters_policy_id_key_key" UNIQUE("policy_id","key"),
	CONSTRAINT "policy_chapters_number_range" CHECK ("policy_chapters"."number" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "policy_deviations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"policy_id" uuid,
	"subject" text NOT NULL,
	"amount_cents" bigint,
	"purchase_type" text,
	"rule_skipped" text NOT NULL,
	"justification" text NOT NULL,
	"created_by_user_id" uuid,
	"approver_role" text DEFAULT '' NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_deviations_justification_not_empty" CHECK (length(btrim("policy_deviations"."justification")) > 0)
);
--> statement-breakpoint
CREATE TABLE "policy_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"policy_id" uuid,
	"file_id" uuid,
	"title" text NOT NULL,
	"source_label" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'referentie' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"ingested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"chapter_id" uuid,
	"user_id" uuid,
	"comment" text DEFAULT '' NOT NULL,
	"decision" text DEFAULT 'comment' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"rule_set" text DEFAULT 'current' NOT NULL,
	"purchase_type" text DEFAULT 'any' NOT NULL,
	"min_amount_cents" bigint DEFAULT 0 NOT NULL,
	"max_amount_cents" bigint,
	"procedure" text DEFAULT 'enkelvoudig_onderhands' NOT NULL,
	"min_quotes" integer DEFAULT 1 NOT NULL,
	"extra_requirement" text DEFAULT 'vastleggen_offerteaanvraag' NOT NULL,
	"advisor_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "thresholds_amount_range" CHECK ("thresholds"."max_amount_cents" is null or "thresholds"."max_amount_cents" > "thresholds"."min_amount_cents"),
	CONSTRAINT "thresholds_min_quotes_positive" CHECK ("thresholds"."min_quotes" >= 1)
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"default_content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prompts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_agent" text,
	"ip" text,
	"expires_at" timestamp NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"locale" text DEFAULT 'nl' NOT NULL,
	"avatar_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_secrets" ADD CONSTRAINT "totp_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_chapters" ADD CONSTRAINT "policy_chapters_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_deviations" ADD CONSTRAINT "policy_deviations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_deviations" ADD CONSTRAINT "policy_deviations_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_deviations" ADD CONSTRAINT "policy_deviations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_deviations" ADD CONSTRAINT "policy_deviations_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_goals" ADD CONSTRAINT "policy_goals_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_reviews" ADD CONSTRAINT "policy_reviews_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_reviews" ADD CONSTRAINT "policy_reviews_chapter_id_policy_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."policy_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_reviews" ADD CONSTRAINT "policy_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thresholds" ADD CONSTRAINT "thresholds_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mandates_organisation_id_idx" ON "mandates" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "policies_organisation_id_idx" ON "policies" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "policy_deviations_organisation_id_idx" ON "policy_deviations" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "policy_documents_organisation_id_idx" ON "policy_documents" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "policy_goals_policy_id_idx" ON "policy_goals" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "policy_reviews_policy_id_idx" ON "policy_reviews" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "thresholds_organisation_id_idx" ON "thresholds" USING btree ("organisation_id");