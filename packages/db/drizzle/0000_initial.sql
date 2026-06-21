CREATE TYPE "public"."user_role" AS ENUM('admin', 'organizer', 'volunteer');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('permanent', 'temporary');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'active', 'ended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('created', 'scanned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('success', 'duplicate', 'expired', 'invalid');--> statement-breakpoint
CREATE TABLE "organizations" (
	"organization_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"name" varchar(255),
	"role" "user_role" NOT NULL,
	"account_type" "account_type" DEFAULT 'permanent' NOT NULL,
	"temporary_pin_hash" varchar(255),
	"event_id_restricted" uuid,
	"expires_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_name" varchar(255) NOT NULL,
	"event_date" date NOT NULL,
	"validity_days" integer DEFAULT 1 NOT NULL,
	"status" "event_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attendees" (
	"attendee_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"mobile" varchar(20),
	"location" varchar(255),
	"status" "ticket_status" DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"ticket_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendee_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "ticket_status" DEFAULT 'created' NOT NULL,
	"scanned_at" timestamp with time zone,
	"scanned_by_volunteer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_logs" (
	"scan_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"volunteer_id" uuid NOT NULL,
	"scan_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"scan_status" "scan_status" NOT NULL,
	"scan_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"request_id" varchar(255) PRIMARY KEY NOT NULL,
	"response_body" text NOT NULL,
	"status_code" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"config_key" varchar(255) PRIMARY KEY NOT NULL,
	"config_value" varchar(500) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_attendee_id_attendees_attendee_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendees"("attendee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_scanned_by_volunteer_id_users_user_id_fk" FOREIGN KEY ("scanned_by_volunteer_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_ticket_id_tickets_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("ticket_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_volunteer_id_users_user_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "users_event_expires_idx" ON "users" USING btree ("event_id_restricted","expires_at");--> statement-breakpoint
CREATE INDEX "events_org_date_idx" ON "events" USING btree ("organization_id","event_date");--> statement-breakpoint
CREATE INDEX "events_status_date_idx" ON "events" USING btree ("status","event_date");--> statement-breakpoint
CREATE INDEX "events_event_date_idx" ON "events" USING btree ("event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendees_event_email_idx" ON "attendees" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "attendees_event_status_idx" ON "attendees" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "tickets_event_id_idx" ON "tickets" USING btree ("event_id","ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_event_status_idx" ON "tickets" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "tickets_scanned_at_idx" ON "tickets" USING btree ("scanned_at");--> statement-breakpoint
CREATE INDEX "scan_logs_event_timestamp_idx" ON "scan_logs" USING btree ("event_id","scan_timestamp");--> statement-breakpoint
CREATE INDEX "scan_logs_ticket_idx" ON "scan_logs" USING btree ("ticket_id");
