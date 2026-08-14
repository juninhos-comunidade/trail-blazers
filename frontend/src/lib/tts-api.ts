import { readToken } from "@auth/token-storage";
import { API_URL } from "./env";

export type TtsFailureReason = "not_configured" | "rate_limited" | "unavailable" | "network_error" | "unknown";

export class TtsError extends Error {
  readonly reason: TtsFailureReason;

  constructor(message: string, reason: TtsFailureReason) {
    super(message);
    this.reason = reason;
  }
}

export async function synthesizeSpeech(text: string): Promise<Blob> {
  const token = readToken();

  let response: Response;

  try {
    response = await fetch(`${API_URL}/tts/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new TtsError("Não foi possível conectar ao leitor de voz do servidor.", "network_error");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string; reason?: TtsFailureReason }
      | null;

    throw new TtsError(body?.message ?? `TTS respondeu ${response.status}`, body?.reason ?? "unknown");
  }

  return response.blob();
}
