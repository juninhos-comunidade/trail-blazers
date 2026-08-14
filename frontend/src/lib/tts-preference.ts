import { useCallback, useState } from "react";

const TTS_STORAGE_KEY = "interviewtrail.tts-enabled";

export function readTtsPreference(): boolean {
  try {
    return localStorage.getItem(TTS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTtsPreference(enabled: boolean): void {
  try {
    localStorage.setItem(TTS_STORAGE_KEY, enabled ? "1" : "0");
  } catch {}
}

export function useTtsPreference(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(readTtsPreference);

  const set = useCallback((next: boolean) => {
    setEnabled(next);
    writeTtsPreference(next);
  }, []);

  return [enabled, set];
}
