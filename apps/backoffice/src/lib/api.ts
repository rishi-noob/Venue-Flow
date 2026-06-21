const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface AuthUser {
  user_id: string;
  email: string;
  role: string;
  token: string;
}

function getToken(): string | null {
  return localStorage.getItem("vf_token");
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("vf_user");
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(user: AuthUser) {
  localStorage.setItem("vf_token", user.token);
  localStorage.setItem("vf_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("vf_token");
  localStorage.removeItem("vf_user");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function downloadCsv(eventId: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}/v1/events/${eventId}/attendance.csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { API_URL };
