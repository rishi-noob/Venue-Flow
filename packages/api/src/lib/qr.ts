import QRCode from "qrcode";

export interface QrPayload {
  ticket_id: string;
  event_id: string;
}

export async function generateQrImage(payload: QrPayload): Promise<string> {
  const data = JSON.stringify(payload);
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export function parseQrData(raw: string): QrPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.ticket_id && parsed.event_id) {
      return { ticket_id: parsed.ticket_id, event_id: parsed.event_id };
    }
    if (/^[0-9a-f-]{36}$/i.test(raw.trim())) {
      return { ticket_id: raw.trim(), event_id: "" };
    }
    return null;
  } catch {
    if (/^[0-9a-f-]{36}$/i.test(raw.trim())) {
      return { ticket_id: raw.trim(), event_id: "" };
    }
    return null;
  }
}
