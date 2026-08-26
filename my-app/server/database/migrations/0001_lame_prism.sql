CREATE TABLE "policy_step_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"check_kind" text DEFAULT 'input' NOT NULL,
	"item_index" integer NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_step_checks_policy_step_kind_index_key" UNIQUE("policy_id","step_key","check_kind","item_index"),
	CONSTRAINT "policy_step_checks_item_index_non_negative" CHECK ("policy_step_checks"."item_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "policy_step_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"field_key" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_step_entries_policy_step_field_key" UNIQUE("policy_id","step_key","field_key")
);
--> statement-breakpoint
CREATE TABLE "policy_step_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"field_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policy_step_checks" ADD CONSTRAINT "policy_step_checks_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_step_entries" ADD CONSTRAINT "policy_step_entries_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_step_items" ADD CONSTRAINT "policy_step_items_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "policy_step_checks_policy_id_idx" ON "policy_step_checks" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "policy_step_entries_policy_id_idx" ON "policy_step_entries" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "policy_step_items_policy_id_idx" ON "policy_step_items" USING btree ("policy_id");