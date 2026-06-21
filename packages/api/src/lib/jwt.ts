import jwt from "jsonwebtoken";
import type { JwtPayload, UserRole } from "@venue-flow/shared";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

const TOKEN_EXPIRY_SECONDS: Record<UserRole, number> = {
  admin: 86400,
  organizer: 86400,
  volunteer: 28800,
};

export function signToken(payload: JwtPayload): { token: string; expiresIn: number } {
  const expiresIn =
    payload.accountType === "temporary" ? 28800 : TOKEN_EXPIRY_SECONDS[payload.role];
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn });
  return { token, expiresIn };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function getRedirectUrl(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/backoffice/admin";
    case "organizer":
      return "/backoffice/organizer";
    case "volunteer":
      return "/scanner";
    default:
      return "/";
  }
}
