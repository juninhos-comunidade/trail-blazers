import { readToken } from "@auth/token-storage";
import { API_URL } from "./env";

export async function synthesizeSpeech(text: string): Promise<Blob> {
  const token = readToken();

  const response = await fetch(`${API_URL}/tts/speak`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS respondeu ${response.status}`);
  }

  return response.blob();
}
