import { useEffect, useState, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadCsv } from "../lib/api";

interface EventData {
  eventId: string;
  eventName: string;
  eventDate: string;
  validityDays: number;
  status: string;
  valid_from: string;
  valid_until: string;
  stats: { total_attendees: number; scanned: number; no_show: number };
}

interface AttendeeRow {
  attendeeId: string;
  name: string;
  email: string;
  mobile: string | null;
  location: string | null;
  ticketStatus: string | null;
  scannedAt: string | null;
  ticketId: string | null;
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [location, setLocation] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [generating, setGenerating] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrName, setQrName] = useState("");

  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [volName, setVolName] = useState("");
  const [volEmail, setVolEmail] = useState("");
  const [volPin, setVolPin] = useState("");
  const [volMessage, setVolMessage] = useState("");
  const [volLoading, setVolLoading] = useState(false);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (eventId) loadAll();
  }, [eventId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [ev, att] = await Promise.all([
        api<EventData>(`/v1/events/${eventId}`),
        api<{ attendees: AttendeeRow[] }>(`/v1/events/${eventId}/attendees`),
      ]);
      setEvent(ev);
      setAttendees(att.attendees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAttendee(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setQrImage(null);

    if (!name.trim() || !email.trim()) {
      setFormError("Name and Email are required");
      return;
    }

    setGenerating(true);
    try {
      const data = await api<{
        qr_code_image: string;
        message: string;
        name: string;
      }>(`/v1/events/${eventId}/attendees`, {
        method: "POST",
        headers: { "X-Request-ID": crypto.randomUUID() },
        body: JSON.stringify({ name, email, mobile: mobile || undefined, location: location || undefined }),
      });
      setFormSuccess(data.message);
      setQrImage(data.qr_code_image);
      setQrName(data.name);
      setName("");
      setEmail("");
      setMobile("");
      setLocation("");
      loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to generate QR");
    } finally {
      setGenerating(false);
    }
  }

  async function handleInviteVolunteer(e: FormEvent) {
    e.preventDefault();
    setVolMessage("");
    setVolPin("");
    setVolLoading(true);
    try {
      const data = await api<{ temporary_pin: string; message: string }>(
        `/v1/events/${eventId}/volunteers`,
        {
          method: "POST",
          body: JSON.stringify({
            name: volName,
            email: volEmail || undefined,
          }),
        }
      );
      setVolPin(data.temporary_pin);
      setVolMessage(data.message);
    } catch (err) {
      setVolMessage(err instanceof Error ? err.message : "Failed to create volunteer");
    } finally {
      setVolLoading(false);
    }
  }

  async function handleExport() {
    if (!event) return;
    setExporting(true);
    try {
      const filename = `${event.eventName.replace(/\s+/g, "_")}_${event.eventDate}_attendance.csv`;
      await downloadCsv(eventId!, filename);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function copyPin() {
    if (volPin) navigator.clipboard.writeText(volPin);
  }

  if (loading) {
    return (
      <div className="layout">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="layout">
        <p className="error-text">{error || "Event not found"}</p>
        <Link to="/events">← Back to Events</Link>
      </div>
    );
  }

  const attendancePct =
    event.stats.total_attendees > 0
      ? Math.round((event.stats.scanned / event.stats.total_attendees) * 100)
      : 0;

  return (
    <div className="layout">
      <header className="layout-header">
        <div>
          <h1>{event.eventName}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {event.eventDate} · Valid {event.validityDays} day(s) ·{" "}
            <span className={`badge badge-${event.status === "active" ? "active" : "ended"}`}>
              {event.status}
            </span>
          </p>
        </div>
        <Link to="/events">
          <button className="btn-secondary">← Events</button>
        </Link>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{event.stats.total_attendees}</div>
          <div className="label">Total Attendees</div>
        </div>
        <div className="stat-card">
          <div className="value">{event.stats.scanned}</div>
          <div className="label">Scanned</div>
        </div>
        <div className="stat-card">
          <div className="value">{event.stats.no_show}</div>
          <div className="label">No-Show</div>
        </div>
        <div className="stat-card">
          <div className="value">{attendancePct}%</div>
          <div className="label">Attendance</div>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={() => setShowVolunteerModal(true)}>
          Invite Volunteer
        </button>
        <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </div>

      <h2 className="section-title">Add Attendee</h2>
      <div className="card" style={{ maxWidth: 520, marginBottom: "2rem" }}>
        <form onSubmit={handleAddAttendee}>
          <div className="form-group">
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Mobile</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91-9876543210" />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Delhi" />
          </div>
          {formError && <p className="error-text">{formError}</p>}
          {formSuccess && <p className="success-text">✅ {formSuccess}</p>}
          <button type="submit" className="btn-primary" disabled={generating}>
            {generating ? "Generating…" : "Generate QR"}
          </button>
        </form>

        {qrImage && (
          <div className="qr-display">
            <p style={{ color: "#333", marginBottom: "0.5rem", fontWeight: 600 }}>{qrName}</p>
            <img src={qrImage} alt={`QR code for ${qrName}`} />
            <a href={qrImage} download={`qr_${qrName.replace(/\s+/g, "_")}.png`}>
              <button className="btn-secondary" style={{ marginTop: "0.75rem" }}>
                Download QR
              </button>
            </a>
          </div>
        )}
      </div>

      <h2 className="section-title">Attendees ({attendees.length})</h2>
      <div className="card">
        {attendees.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No attendees yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Scanned At</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.attendeeId}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>
                    <span className={`badge badge-${a.ticketStatus === "scanned" ? "scanned" : "created"}`}>
                      {a.ticketStatus === "scanned" ? "scanned" : "no-show"}
                    </span>
                  </td>
                  <td>{a.scannedAt ? new Date(a.scannedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showVolunteerModal && (
        <div className="modal-overlay" onClick={() => setShowVolunteerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Invite Volunteer</h2>
            <form onSubmit={handleInviteVolunteer}>
              <div className="form-group">
                <label>Volunteer Name *</label>
                <input value={volName} onChange={(e) => setVolName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email (optional)</label>
                <input type="email" value={volEmail} onChange={(e) => setVolEmail(e.target.value)} />
              </div>
              {volPin && (
                <>
                  <div className="pin-display">{volPin}</div>
                  <button type="button" className="btn-secondary" onClick={copyPin} style={{ width: "100%" }}>
                    Copy PIN
                  </button>
                </>
              )}
              {volMessage && <p className={volPin ? "success-text" : "error-text"}>{volMessage}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowVolunteerModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn-primary" disabled={volLoading}>
                  {volLoading ? "Generating…" : "Generate Temporary PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
