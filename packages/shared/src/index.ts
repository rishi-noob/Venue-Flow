import { z } from "zod";

export const loginPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  login_type: z.literal("password"),
});

export const loginPinSchema = z.object({
  email: z.string().email().optional(),
  pin: z.string().length(6),
  login_type: z.literal("temporary_pin"),
});

export const loginSchema = z.discriminatedUnion("login_type", [
  loginPasswordSchema,
  loginPinSchema,
]);

export const createEventSchema = z.object({
  event_name: z.string().min(1, "Event name is required"),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  validity_days: z.number().int().min(1).max(30).default(1),
});

export const createAttendeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  mobile: z.string().optional(),
  location: z.string().optional(),
});

export const createTempVolunteerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  expires_at: z.string().datetime().optional(),
});

export const createPermanentVolunteerSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  account_type: z.literal("permanent"),
});

export const scanValidateSchema = z.object({
  ticket_id: z.string().uuid(),
  event_id: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateAttendeeInput = z.infer<typeof createAttendeeSchema>;

export type UserRole = "admin" | "organizer" | "volunteer";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  accountType: "permanent" | "temporary";
  organizationId: string;
  eventIdRestricted?: string | null;
  expiresAt?: string | null;
}

export interface ApiError {
  status: "error";
  message: string;
  error_code: string;
}

export function computeValidityWindow(eventDate: string, validityDays: number) {
  const start = new Date(`${eventDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + validityDays);
  return { validFrom: start, validUntil: end };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
