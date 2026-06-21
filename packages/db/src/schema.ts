import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["admin", "organizer", "volunteer"]);
export const accountTypeEnum = pgEnum("account_type", ["permanent", "temporary"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive", "suspended"]);
export const eventStatusEnum = pgEnum("event_status", ["draft", "active", "ended", "archived"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["created", "scanned", "completed"]);
export const scanStatusEnum = pgEnum("scan_status", ["success", "duplicate", "expired", "invalid"]);

export const organizations = pgTable("organizations", {
  organizationId: uuid("organization_id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    userId: uuid("user_id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.organizationId),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    name: varchar("name", { length: 255 }),
    role: userRoleEnum("role").notNull(),
    accountType: accountTypeEnum("account_type").notNull().default("permanent"),
    temporaryPinHash: varchar("temporary_pin_hash", { length: 255 }),
    eventIdRestricted: uuid("event_id_restricted"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_status_idx").on(table.role, table.status),
    index("users_event_expires_idx").on(table.eventIdRestricted, table.expiresAt),
  ]
);

export const events = pgTable(
  "events",
  {
    eventId: uuid("event_id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.organizationId),
    eventName: varchar("event_name", { length: 255 }).notNull(),
    eventDate: date("event_date").notNull(),
    validityDays: integer("validity_days").notNull().default(1),
    status: eventStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("events_org_date_idx").on(table.organizationId, table.eventDate),
    index("events_status_date_idx").on(table.status, table.eventDate),
    index("events_event_date_idx").on(table.eventDate),
  ]
);

export const attendees = pgTable(
  "attendees",
  {
    attendeeId: uuid("attendee_id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.eventId),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    mobile: varchar("mobile", { length: 20 }),
    location: varchar("location", { length: 255 }),
    status: ticketStatusEnum("status").notNull().default("created"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("attendees_event_email_idx").on(table.eventId, table.email),
    index("attendees_event_status_idx").on(table.eventId, table.status),
  ]
);

export const tickets = pgTable(
  "tickets",
  {
    ticketId: uuid("ticket_id").primaryKey().defaultRandom(),
    attendeeId: uuid("attendee_id")
      .notNull()
      .references(() => attendees.attendeeId),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.eventId),
    status: ticketStatusEnum("status").notNull().default("created"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    scannedByVolunteerId: uuid("scanned_by_volunteer_id").references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tickets_event_id_idx").on(table.eventId, table.ticketId),
    index("tickets_event_status_idx").on(table.eventId, table.status),
    index("tickets_scanned_at_idx").on(table.scannedAt),
  ]
);

export const scanLogs = pgTable(
  "scan_logs",
  {
    scanLogId: uuid("scan_log_id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.ticketId),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.eventId),
    volunteerId: uuid("volunteer_id")
      .notNull()
      .references(() => users.userId),
    scanTimestamp: timestamp("scan_timestamp", { withTimezone: true }).notNull().defaultNow(),
    scanStatus: scanStatusEnum("scan_status").notNull(),
    scanIp: varchar("scan_ip", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scan_logs_event_timestamp_idx").on(table.eventId, table.scanTimestamp),
    index("scan_logs_ticket_idx").on(table.ticketId),
  ]
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  requestId: varchar("request_id", { length: 255 }).primaryKey(),
  responseBody: text("response_body").notNull(),
  statusCode: integer("status_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const config = pgTable("config", {
  configKey: varchar("config_key", { length: 255 }).primaryKey(),
  configValue: varchar("config_value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventsRelations = relations(events, ({ many, one }) => ({
  attendees: many(attendees),
  tickets: many(tickets),
  creator: one(users, { fields: [events.createdBy], references: [users.userId] }),
}));

export const attendeesRelations = relations(attendees, ({ one, many }) => ({
  event: one(events, { fields: [attendees.eventId], references: [events.eventId] }),
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  attendee: one(attendees, { fields: [tickets.attendeeId], references: [attendees.attendeeId] }),
  event: one(events, { fields: [tickets.eventId], references: [events.eventId] }),
}));
