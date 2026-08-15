import { synthesizeSpeech, TtsError, type TtsFailureReason } from "./tts-api";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const global = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return global.SpeechRecognition ?? global.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

interface RecognizerHandlers {
  lang?: string;
  onResult: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (reason: string) => void;
}

export function createRecognizer({
  lang = "pt-BR",
  onResult,
  onEnd,
  onError,
}: RecognizerHandlers): { start: () => void; stop: () => void } {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) {
    return {
      start: () => onError("unsupported"),
      stop: () => {},
    };
  }

  const recognizer = new Recognition();
  recognizer.lang = lang;
  recognizer.continuous = true;
  recognizer.interimResults = true;

  recognizer.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      onResult(result[0].transcript, result.isFinal);
    }
  };
  recognizer.onerror = (event) => onError(event.error);
  recognizer.onend = () => onEnd();

  return {
    start: () => recognizer.start(),
    stop: () => recognizer.stop(),
  };
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const onVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onVoicesChanged);
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(synth.getVoices());
    }, 500);
  });
}

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const prefix = lang.split("-")[0];
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));
  if (candidates.length === 0) return null;

  const exactMatch = candidates.filter((voice) => voice.lang.toLowerCase() === lang.toLowerCase());
  const pool = exactMatch.length > 0 ? exactMatch : candidates;

  return pool.find((voice) => !voice.localService) ?? pool[0];
}

async function speakWithBrowser(text: string, { lang = "pt-BR" }: { lang?: string } = {}): Promise<void> {
  if (!isSpeechSynthesisSupported()) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const voices = await loadVoices();
  const voice = pickBestVoice(voices, lang);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.pitch = 1;
  if (voice) utterance.voice = voice;

  synth.speak(utterance);
}

let currentAudio: HTMLAudioElement | null = null;

function stopCurrentAudio(): void {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.removeAttribute("src");
  currentAudio = null;
}

let latestSpeakToken = 0;

export type SpeechStatus =
  | { source: "server" }
  | { source: "browser"; reason: TtsFailureReason }
  | { source: "none"; reason: TtsFailureReason };

const FALLBACK_MESSAGES: Record<TtsFailureReason, string> = {
  not_configured: "Leitura de voz do servidor não configurada",
  rate_limited: "Leitor de voz do servidor ocupado com outra entrevista agora",
  unavailable: "Leitor de voz do servidor indisponível no momento",
  network_error: "Não foi possível conectar ao leitor de voz do servidor",
  unknown: "Leitor de voz do servidor falhou",
};

export function describeSpeechStatus(status: SpeechStatus): string | null {
  if (status.source === "server") return null;

  const base = FALLBACK_MESSAGES[status.reason];
  return status.source === "browser"
    ? `${base} — usando a voz do navegador.`
    : `${base}, e este navegador não tem leitura de voz embutida.`;
}

export async function speak(
  text: string,
  { lang = "pt-BR", onStatus }: { lang?: string; onStatus?: (status: SpeechStatus) => void } = {},
): Promise<void> {
  const myToken = ++latestSpeakToken;
  const isStale = () => myToken !== latestSpeakToken;

  stopCurrentAudio();
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();

  try {
    const blob = await synthesizeSpeech(text);
    if (isStale()) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    currentAudio = audio;

    await audio.play();
    if (isStale()) return;

    onStatus?.({ source: "server" });
    return;
  } catch (err) {
    if (isStale()) return;

    const reason = err instanceof TtsError ? err.reason : "unknown";

    if (!isSpeechSynthesisSupported()) {
      onStatus?.({ source: "none", reason });
      return;
    }

    onStatus?.({ source: "browser", reason });
  }

  if (isStale()) return;
  await speakWithBrowser(text, { lang });
}

export function stopSpeaking(): void {
  stopCurrentAudio();
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
