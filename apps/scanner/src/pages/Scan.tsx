import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { api, clearAuth, getStoredUser, type ScanResult } from "../lib/api";

function playBeep(success: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 220;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.15 : 0.3));
  } catch {
    // Audio optional
  }
}

function parseTicketFromQr(raw: string): { ticket_id: string; event_id?: string } | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.ticket_id) return parsed;
  } catch {
    if (/^[0-9a-f-]{36}$/i.test(raw.trim())) {
      return { ticket_id: raw.trim() };
    }
  }
  return null;
}

export default function Scan() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const [manualId, setManualId] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const validateTicket = useCallback(
    async (ticketId: string, eventId?: string) => {
      if (processing) return;
      setProcessing(true);

      try {
        const data = await api<ScanResult>("/v1/scanner/validate", {
          method: "POST",
          body: JSON.stringify({
            ticket_id: ticketId,
            event_id: eventId || user?.event_id,
          }),
        });

        setResult(data);
        playBeep(data.status === "success");

        const delay = data.status === "success" ? 2000 : 3000;
        setTimeout(() => {
          setResult(null);
          setProcessing(false);
          scanningRef.current = false;
        }, delay);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scan failed";
        setResult({
          ticket_id: ticketId,
          status: "invalid",
          message: msg,
          display: "❌ RED",
        });
        playBeep(false);
        setTimeout(() => {
          setResult(null);
          setProcessing(false);
          scanningRef.current = false;
        }, 3000);
      }
    },
    [processing, user?.event_id]
  );

  const handleScan = useCallback(
    (raw: string) => {
      if (scanningRef.current || processing) return;
      scanningRef.current = true;

      const parsed = parseTicketFromQr(raw);
      if (!parsed) {
        setResult({
          ticket_id: "",
          status: "invalid",
          message: "Invalid QR code",
          display: "❌ RED",
        });
        playBeep(false);
        setTimeout(() => {
          setResult(null);
          scanningRef.current = false;
        }, 3000);
        return;
      }

      validateTicket(parsed.ticket_id, parsed.event_id);
    },
    [processing, validateTicket]
  );

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;

    async function startScanner() {
      try {
        scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded) => handleScan(decoded),
          () => {}
        );
      } catch {
        setCameraError("Camera access denied. Use manual entry below.");
      }
    }

    startScanner();

    return () => {
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [handleScan]);

  function logout() {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    clearAuth();
    navigate("/login");
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualId.trim()) {
      handleScan(manualId.trim());
      setManualId("");
    }
  }

  const isSuccess = result?.status === "success";

  return (
    <div className="scan-page">
      <header className="scan-header">
        <h1>Scanner</h1>
        <button onClick={logout}>Logout</button>
      </header>

      <div className="scanner-container">
        <p className="instruction">Point camera at QR code</p>
        <div id="qr-reader" />
        {cameraError && <p className="error-text">{cameraError}</p>}

        <div className="manual-entry">
          <p>Or enter Ticket ID manually</p>
          <form className="manual-row" onSubmit={handleManualSubmit}>
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Ticket UUID"
              disabled={processing}
            />
            <button type="submit" disabled={processing}>
              Check
            </button>
          </form>
        </div>
      </div>

      {result && (
        <div className={`result-overlay ${isSuccess ? "success" : "error"}`}>
          <div className="icon">{isSuccess ? "✅" : "❌"}</div>
          <h2>{isSuccess ? "Entry Granted" : result.message.split("—")[0].trim()}</h2>
          {result.attendee_name && <p className="name">{result.attendee_name}</p>}
          <p className="detail">
            {result.status === "duplicate" && result.scanned_at_previous
              ? `Checked in at ${new Date(result.scanned_at_previous).toLocaleTimeString()}`
              : result.status === "success" && result.scanned_at
                ? new Date(result.scanned_at).toLocaleTimeString()
                : result.message}
          </p>
          <button onClick={() => { setResult(null); setProcessing(false); scanningRef.current = false; }}>
            Next Attendee
          </button>
        </div>
      )}
    </div>
  );
}
