import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function EventNew() {
  const navigate = useNavigate();
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [validityDays, setValidityDays] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!eventName.trim()) {
      setError("Event name is required");
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ event_id: string; message: string }>("/v1/events", {
        method: "POST",
        body: JSON.stringify({
          event_name: eventName.trim(),
          event_date: eventDate,
          validity_days: validityDays,
        }),
      });
      setSuccess(data.message);
      setTimeout(() => navigate(`/events/${data.event_id}`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <h1>Create Event</h1>
        <Link to="/events">
          <button className="btn-secondary">← Back to Events</button>
        </Link>
      </header>

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Event Name *</label>
            <input
              id="name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Russian House Wine Tasting"
              required
            />
            {!eventName.trim() && error.includes("name") && (
              <p className="error-text">Event name is required</p>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="date">Event Date *</label>
            <input
              id="date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="validity">Validity Window (days)</label>
            <input
              id="validity"
              type="number"
              min={1}
              max={30}
              value={validityDays}
              onChange={(e) => setValidityDays(parseInt(e.target.value) || 1)}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">✅ {success}</p>}
          <button type="submit" className="btn-primary" disabled={loading || !eventName.trim()}>
            {loading ? "Saving…" : "Save Event"}
          </button>
        </form>
      </div>
    </div>
  );
}
