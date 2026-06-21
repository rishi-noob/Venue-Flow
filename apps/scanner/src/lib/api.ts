const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface AuthUser {
  user_id: string;
  email: string;
  role: string;
  token: string;
  event_id?: string;
  expires_at?: string;
}

function getToken(): string | null {
  return localStorage.getItem("vf_scanner_token");
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("vf_scanner_user");
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(user: AuthUser) {
  localStorage.setItem("vf_scanner_token", user.token);
  localStorage.setItem("vf_scanner_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("vf_scanner_token");
  localStorage.removeItem("vf_scanner_user");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Connection lost — Check your WiFi and try again");
  }

  if (res.status === 401 || res.status === 410) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 422) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface ScanResult {
  ticket_id: string;
  status: "success" | "duplicate" | "expired" | "invalid";
  message: string;
  attendee_name?: string;
  scanned_at?: string;
  scanned_at_previous?: string;
  display: string;
}

export { API_URL };
