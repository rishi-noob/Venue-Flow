import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuth } from "../lib/api";
import PasswordInput from "../components/PasswordInput";

type LoginMode = "password" | "pin";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>("pin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body =
        mode === "password"
          ? { email, password, login_type: "password" as const }
          : { email: email || undefined, pin, login_type: "temporary_pin" as const };

      const data = await api<{
        user_id: string;
        email: string;
        role: string;
        token: string;
        event_id?: string;
        expires_at?: string;
      }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (data.role !== "volunteer") {
        setError("This app is for volunteers only. Use Back Office for admin/organizer login.");
        return;
      }

      setAuth(data);
      navigate("/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Venue Flow</h1>
        <p className="subtitle">Scanner — Door Check-in</p>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${mode === "pin" ? "active" : ""}`}
            onClick={() => setMode("pin")}
          >
            Temporary PIN
          </button>
          <button
            type="button"
            className={`tab ${mode === "password" ? "active" : ""}`}
            onClick={() => setMode("password")}
          >
            Password
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email {mode === "pin" ? "(optional)" : ""}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={mode === "password"}
              autoComplete="email"
            />
          </div>

          {mode === "password" ? (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="pin">6-digit PIN</label>
              <input
                id="pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                placeholder="123456"
              />
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
