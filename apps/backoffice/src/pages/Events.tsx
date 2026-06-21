import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearAuth, getStoredUser } from "../lib/api";

interface EventRow {
  eventId: string;
  eventName: string;
  eventDate: string;
  validityDays: number;
  status: string;
  attendeeCount: number;
  scannedCount: number;
}

export default function Events() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEvents();
  }, [statusFilter, search]);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const qs = params.toString();
      const data = await api<{ events: EventRow[] }>(`/v1/events${qs ? `?${qs}` : ""}`);
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <h1>
          <span className="brand">Venue Flow</span> — Events
        </h1>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{user?.email}</span>
          <button className="btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="filters">
          <input
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <Link to="/events/new">
          <button className="btn-primary">+ Create Event</button>
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading events…</p>
        ) : events.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No events yet. Create your first event.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Date</th>
                <th>Status</th>
                <th>Attendees</th>
                <th>Scanned</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.eventId}>
                  <td>{ev.eventName}</td>
                  <td>{ev.eventDate}</td>
                  <td>
                    <span className={`badge badge-${ev.status === "active" ? "active" : "ended"}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td>{ev.attendeeCount}</td>
                  <td>{ev.scannedCount}</td>
                  <td>
                    <Link to={`/events/${ev.eventId}`}>
                      <button className="btn-secondary" style={{ padding: "0.375rem 0.75rem", fontSize: "0.875rem" }}>
                        Manage
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
