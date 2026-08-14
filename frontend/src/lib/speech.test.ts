import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tts-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tts-api")>();
  return {
    ...actual,
    synthesizeSpeech: vi.fn(),
  };
});

import { synthesizeSpeech, TtsError, type TtsFailureReason } from "./tts-api";
import {
  createRecognizer,
  describeSpeechStatus,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak,
  stopSpeaking,
} from "./speech";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVoice(overrides: Partial<{ lang: string; localService: boolean; name: string }> = {}) {
  return { lang: "pt-BR", localService: true, name: "Voice", ...overrides } as SpeechSynthesisVoice;
}

class FakeUtterance {
  text: string;
  lang = "";
  rate = 0;
  pitch = 0;
  voice: SpeechSynthesisVoice | undefined = undefined;
  constructor(text: string) {
    this.text = text;
    capturedUtterances.push(this);
  }
}

let capturedUtterances: FakeUtterance[] = [];

function makeFakeSynth(getVoicesImpl: () => SpeechSynthesisVoice[]) {
  return {
    getVoices: vi.fn(getVoicesImpl),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    speak: vi.fn(),
    cancel: vi.fn(),
  };
}

function makeFakeAudio() {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    addEventListener: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Shared browser API stubbing / restoration
// ---------------------------------------------------------------------------

let originalSpeechRecognition: unknown;
let originalWebkitSpeechRecognition: unknown;
let originalSpeechSynthesis: unknown;
let originalSpeechSynthesisUtterance: unknown;
let originalAudio: unknown;
let originalCreateObjectURL: typeof URL.createObjectURL;
let originalRevokeObjectURL: typeof URL.revokeObjectURL;

beforeEach(() => {
  capturedUtterances = [];

  originalSpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition;
  originalWebkitSpeechRecognition = (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  originalSpeechSynthesis = (window as unknown as Record<string, unknown>).speechSynthesis;
  originalSpeechSynthesisUtterance = (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
  originalAudio = (window as unknown as Record<string, unknown>).Audio;
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;

  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
  delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
  delete (window as unknown as Record<string, unknown>).Audio;

  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();

  const w = window as unknown as Record<string, unknown>;
  if (originalSpeechRecognition === undefined) delete w.SpeechRecognition;
  else w.SpeechRecognition = originalSpeechRecognition;

  if (originalWebkitSpeechRecognition === undefined) delete w.webkitSpeechRecognition;
  else w.webkitSpeechRecognition = originalWebkitSpeechRecognition;

  if (originalSpeechSynthesis === undefined) delete w.speechSynthesis;
  else w.speechSynthesis = originalSpeechSynthesis;

  if (originalSpeechSynthesisUtterance === undefined) delete w.SpeechSynthesisUtterance;
  else w.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;

  if (originalAudio === undefined) delete w.Audio;
  else w.Audio = originalAudio;

  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

// ---------------------------------------------------------------------------
// isSpeechRecognitionSupported / isSpeechSynthesisSupported
// ---------------------------------------------------------------------------

describe("isSpeechRecognitionSupported", () => {
  it("returns false when neither constructor is present", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it("returns true when window.SpeechRecognition is present", () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = class {} as unknown;
    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it("returns true when only window.webkitSpeechRecognition is present", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = class {} as unknown;
    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it("prefers window.SpeechRecognition over webkitSpeechRecognition when both are present", () => {
    let usedStandard = false;
    let usedWebkit = false;

    class StandardCtor {
      constructor() {
        usedStandard = true;
      }
    }
    class WebkitCtor {
      constructor() {
        usedWebkit = true;
      }
    }

    (window as unknown as Record<string, unknown>).SpeechRecognition = StandardCtor as unknown;
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = WebkitCtor as unknown;

    createRecognizer({ onResult: vi.fn(), onEnd: vi.fn(), onError: vi.fn() });

    expect(usedStandard).toBe(true);
    expect(usedWebkit).toBe(false);
  });
});

describe("isSpeechSynthesisSupported", () => {
  it("returns false when window.speechSynthesis is absent", () => {
    expect(isSpeechSynthesisSupported()).toBe(false);
  });

  it("returns true when window.speechSynthesis is present", () => {
    (window as unknown as Record<string, unknown>).speechSynthesis = {} as unknown;
    expect(isSpeechSynthesisSupported()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createRecognizer
// ---------------------------------------------------------------------------

describe("createRecognizer", () => {
  it("without a constructor available, start() synchronously calls onError('unsupported') and stop() is a no-op", () => {
    const onResult = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    const recognizer = createRecognizer({ onResult, onEnd, onError });

    recognizer.start();
    expect(onError).toHaveBeenCalledWith("unsupported");
    expect(onError).toHaveBeenCalledTimes(1);

    expect(() => recognizer.stop()).not.toThrow();
    expect(onResult).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("configures the underlying recognizer with defaults and forwards events", () => {
    let lastInstance: FakeRecognition | undefined;

    class FakeRecognition {
      lang = "";
      continuous = true;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        lastInstance = this;
      }
    }

    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition as unknown;

    const onResult = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    const recognizer = createRecognizer({ onResult, onEnd, onError });

    expect(lastInstance).toBeDefined();
    expect(lastInstance!.lang).toBe("pt-BR");
    expect(lastInstance!.continuous).toBe(false);
    expect(lastInstance!.interimResults).toBe(true);

    recognizer.start();
    expect(lastInstance!.start).toHaveBeenCalledTimes(1);

    recognizer.stop();
    expect(lastInstance!.stop).toHaveBeenCalledTimes(1);
  });

  it("uses the provided lang instead of the default", () => {
    let lastInstance: { lang: string } | undefined;
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onerror = null;
      onend = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        lastInstance = this;
      }
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition as unknown;

    createRecognizer({ lang: "en-US", onResult: vi.fn(), onEnd: vi.fn(), onError: vi.fn() });

    expect(lastInstance!.lang).toBe("en-US");
  });

  it("onresult only processes results from event.resultIndex onward, passing (transcript, isFinal) for each", () => {
    let lastInstance: {
      onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null;
    } = { onresult: null };

    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null = null;
      onerror = null;
      onend = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        lastInstance = this;
      }
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition as unknown;

    const onResult = vi.fn();
    createRecognizer({ onResult, onEnd: vi.fn(), onError: vi.fn() });

    lastInstance.onresult!({
      resultIndex: 1,
      results: [
        { 0: { transcript: "already sent" }, isFinal: true },
        { 0: { transcript: "interim" }, isFinal: false },
        { 0: { transcript: "final" }, isFinal: true },
      ],
    });

    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenNthCalledWith(1, "interim", false);
    expect(onResult).toHaveBeenNthCalledWith(2, "final", true);
  });

  it("onerror and onend forward to the corresponding callbacks", () => {
    let lastInstance: {
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
    } = { onerror: null, onend: null };

    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        lastInstance = this;
      }
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition as unknown;

    const onEnd = vi.fn();
    const onError = vi.fn();
    createRecognizer({ onResult: vi.fn(), onEnd, onError });

    lastInstance.onerror!({ error: "no-speech" });
    expect(onError).toHaveBeenCalledWith("no-speech");

    lastInstance.onend!();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// pickBestVoice (not exported — exercised indirectly through speak()'s
// browser fallback, capturing the SpeechSynthesisUtterance built).
// ---------------------------------------------------------------------------

async function runBrowserFallback(
  voices: SpeechSynthesisVoice[],
  opts?: { lang?: string },
): Promise<FakeUtterance> {
  const synth = makeFakeSynth(() => voices);
  (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;
  (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance as unknown;
  vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new Error("server unavailable"));

  await speak("hello", opts);

  expect(capturedUtterances).toHaveLength(1);
  return capturedUtterances[0];
}

describe("pickBestVoice (via speak() browser fallback)", () => {
  it("returns null (no voice set) when no candidate matches the language prefix", async () => {
    const utterance = await runBrowserFallback([makeVoice({ lang: "fr-FR", localService: false })]);
    expect(utterance.voice).toBeUndefined();
  });

  it("among prefix-only matches, prefers the non-local voice over the local one", async () => {
    const local = makeVoice({ lang: "pt-AO", localService: true, name: "local" });
    const nonLocal = makeVoice({ lang: "pt-PT", localService: false, name: "non-local" });

    const utterance = await runBrowserFallback([local, nonLocal]);
    expect(utterance.voice).toBe(nonLocal);
  });

  it("prefers an exact lang match over a prefix-only match, even if the exact match is local", async () => {
    const exactLocal = makeVoice({ lang: "pt-BR", localService: true, name: "exact-local" });
    const prefixNonLocal = makeVoice({ lang: "pt-PT", localService: false, name: "prefix-non-local" });

    const utterance = await runBrowserFallback([prefixNonLocal, exactLocal], { lang: "pt-BR" });
    expect(utterance.voice).toBe(exactLocal);
  });

  it("falls back to pool[0] when every candidate voice is local", async () => {
    const first = makeVoice({ lang: "pt-AO", localService: true, name: "first" });
    const second = makeVoice({ lang: "pt-PT", localService: true, name: "second" });

    const utterance = await runBrowserFallback([first, second]);
    expect(utterance.voice).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// loadVoices (not exported — exercised indirectly through speak())
// ---------------------------------------------------------------------------

describe("loadVoices (via speak() browser fallback)", () => {
  it("resolves immediately when getVoices() already returns a non-empty list", async () => {
    const voice = makeVoice({ lang: "pt-BR", localService: false });
    const synth = makeFakeSynth(() => [voice]);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance as unknown;
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new Error("boom"));

    await speak("hello");

    expect(synth.addEventListener).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(capturedUtterances[0].voice).toBe(voice);
  });

  it("resolves via the voiceschanged event when the initial list is empty", async () => {
    const voice = makeVoice({ lang: "pt-BR", localService: false });
    let call = 0;
    const synth = makeFakeSynth(() => (call++ === 0 ? [] : [voice]));
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance as unknown;
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new Error("boom"));

    const promise = speak("hello");

    // Wait a microtask so the addEventListener call has happened.
    await Promise.resolve();
    await Promise.resolve();

    expect(synth.addEventListener).toHaveBeenCalledWith("voiceschanged", expect.any(Function));
    const handler = synth.addEventListener.mock.calls.find((c) => c[0] === "voiceschanged")?.[1] as () => void;
    handler();

    await promise;

    expect(synth.removeEventListener).toHaveBeenCalledWith("voiceschanged", handler);
    expect(capturedUtterances[0].voice).toBe(voice);
  });

  it("resolves via the ~500ms timeout when voiceschanged never fires", async () => {
    vi.useFakeTimers();
    try {
      const voice = makeVoice({ lang: "pt-BR", localService: false });
      let call = 0;
      const synth = makeFakeSynth(() => (call++ === 0 ? [] : [voice]));
      (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;
      (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance as unknown;
      vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new Error("boom"));

      const promise = speak("hello");

      await vi.advanceTimersByTimeAsync(500);
      await promise;

      expect(synth.speak).toHaveBeenCalledTimes(1);
      expect(capturedUtterances[0].voice).toBe(voice);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// speak()
// ---------------------------------------------------------------------------

describe("speak", () => {
  it("stops the current audio and cancels browser synthesis before trying the server again", async () => {
    const blob = new Blob(["audio"], { type: "audio/mpeg" });
    vi.mocked(synthesizeSpeech).mockResolvedValue(blob);

    const audioInstances: ReturnType<typeof makeFakeAudio>[] = [];
    (window as unknown as Record<string, unknown>).Audio = vi.fn().mockImplementation(function () {
      const instance = makeFakeAudio();
      audioInstances.push(instance);
      return instance;
    }) as unknown;

    const synth = makeFakeSynth(() => []);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;

    await speak("first");
    await speak("second");

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].pause).toHaveBeenCalledTimes(1);
    expect(audioInstances[0].removeAttribute).toHaveBeenCalledWith("src");
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });

  it("when two calls overlap, only the latest one ever plays audio — even if the older call's network response arrives last", async () => {
    // Simulates double-clicking "repetir": the first speak() is still
    // awaiting its network response when the second one starts. Whichever
    // response comes back, only the most recent call may create/play audio.
    let resolveFirst: (blob: Blob) => void = () => {};
    let resolveSecond: (blob: Blob) => void = () => {};

    vi.mocked(synthesizeSpeech)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

    const audioInstances: ReturnType<typeof makeFakeAudio>[] = [];
    (window as unknown as Record<string, unknown>).Audio = vi.fn().mockImplementation(function () {
      const instance = makeFakeAudio();
      audioInstances.push(instance);
      return instance;
    }) as unknown;

    const synth = makeFakeSynth(() => []);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;

    const firstStatus = vi.fn();
    const secondStatus = vi.fn();

    const firstCall = speak("first", { onStatus: firstStatus });
    const secondCall = speak("second", { onStatus: secondStatus });

    // The older call's response arrives *after* the newer one's.
    resolveSecond(new Blob(["second"], { type: "audio/mpeg" }));
    await secondCall;
    resolveFirst(new Blob(["first"], { type: "audio/mpeg" }));
    await firstCall;

    // Only one Audio was ever created — the stale response never built one.
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);

    expect(secondStatus).toHaveBeenCalledWith({ source: "server" });
    expect(firstStatus).not.toHaveBeenCalled();
  });

  it("on synthesizeSpeech success: builds an Audio, calls onStatus({source:'server'}), and does not fall back to the browser", async () => {
    const blob = new Blob(["audio"], { type: "audio/mpeg" });
    vi.mocked(synthesizeSpeech).mockResolvedValue(blob);

    const audioInstance = makeFakeAudio();
    const AudioCtor = vi.fn().mockImplementation(function () {
      return audioInstance;
    });
    (window as unknown as Record<string, unknown>).Audio = AudioCtor as unknown;

    const synth = makeFakeSynth(() => []);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;

    const onStatus = vi.fn();
    await speak("hello", { onStatus });

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(AudioCtor).toHaveBeenCalledWith("blob:mock-url");
    expect(audioInstance.play).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith({ source: "server" });
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("onStatus omitted does not throw on server success", async () => {
    const blob = new Blob(["audio"], { type: "audio/mpeg" });
    vi.mocked(synthesizeSpeech).mockResolvedValue(blob);
    (window as unknown as Record<string, unknown>).Audio = vi.fn().mockImplementation(function () {
      return makeFakeAudio();
    }) as unknown;

    await expect(speak("hello")).resolves.not.toThrow();
  });

  it("extracts the reason from a TtsError and falls back to the browser when synthesis is supported", async () => {
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new TtsError("rate limited", "rate_limited"));

    const synth = makeFakeSynth(() => []);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance as unknown;

    const onStatus = vi.fn();
    await speak("hello", { onStatus });

    expect(onStatus).toHaveBeenCalledWith({ source: "browser", reason: "rate_limited" });
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("extracts reason 'unknown' from a generic Error", async () => {
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new Error("network went boom"));

    const synth = makeFakeSynth(() => []);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance as unknown;

    const onStatus = vi.fn();
    await speak("hello", { onStatus });

    expect(onStatus).toHaveBeenCalledWith({ source: "browser", reason: "unknown" });
  });

  it("extracts reason 'unknown' when audio.play() rejects after a successful server response", async () => {
    const blob = new Blob(["audio"], { type: "audio/mpeg" });
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(blob);

    const audioInstance = { ...makeFakeAudio(), play: vi.fn().mockRejectedValue(new Error("playback blocked")) };
    (window as unknown as Record<string, unknown>).Audio = vi.fn().mockImplementation(function () {
      return audioInstance;
    }) as unknown;

    const synth = makeFakeSynth(() => []);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance as unknown;

    const onStatus = vi.fn();
    await speak("hello", { onStatus });

    expect(onStatus).toHaveBeenCalledWith({ source: "browser", reason: "unknown" });
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("when browser synthesis is unsupported, calls onStatus({source:'none', reason}) without falling back", async () => {
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new TtsError("not configured", "not_configured"));
    // window.speechSynthesis stays absent (default from beforeEach).

    const onStatus = vi.fn();
    await speak("hello", { onStatus });

    expect(onStatus).toHaveBeenCalledWith({ source: "none", reason: "not_configured" });
    expect(onStatus).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// describeSpeechStatus
// ---------------------------------------------------------------------------

describe("describeSpeechStatus", () => {
  it("returns null for source: 'server'", () => {
    expect(describeSpeechStatus({ source: "server" })).toBeNull();
  });

  const reasons: { reason: TtsFailureReason; base: string }[] = [
    { reason: "not_configured", base: "Leitura de voz do servidor não configurada" },
    { reason: "rate_limited", base: "Leitor de voz do servidor ocupado com outra entrevista agora" },
    { reason: "unavailable", base: "Leitor de voz do servidor indisponível no momento" },
    { reason: "network_error", base: "Não foi possível conectar ao leitor de voz do servidor" },
    { reason: "unknown", base: "Leitor de voz do servidor falhou" },
  ];

  it.each(reasons)("source: 'browser', reason: '$reason' → composed browser-fallback message", ({ reason, base }) => {
    expect(describeSpeechStatus({ source: "browser", reason })).toBe(`${base} — usando a voz do navegador.`);
  });

  it.each(reasons)("source: 'none', reason: '$reason' → composed no-voice message", ({ reason, base }) => {
    expect(describeSpeechStatus({ source: "none", reason })).toBe(
      `${base}, e este navegador não tem leitura de voz embutida.`,
    );
  });
});

// ---------------------------------------------------------------------------
// stopSpeaking
// ---------------------------------------------------------------------------

describe("stopSpeaking", () => {
  it("pauses and clears the current audio, and cancels synthesis when supported", async () => {
    const blob = new Blob(["audio"], { type: "audio/mpeg" });
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(blob);

    const audioInstance = makeFakeAudio();
    (window as unknown as Record<string, unknown>).Audio = vi.fn().mockImplementation(function () {
      return audioInstance;
    }) as unknown;

    const synth = makeFakeSynth(() => []);
    (window as unknown as Record<string, unknown>).speechSynthesis = synth as unknown;

    await speak("hello");
    stopSpeaking();

    expect(audioInstance.pause).toHaveBeenCalledTimes(1);
    expect(audioInstance.removeAttribute).toHaveBeenCalledWith("src");
    expect(synth.cancel).toHaveBeenCalledTimes(2); // once in speak(), once in stopSpeaking()
  });

  it("does not throw and skips synthesis.cancel() when synthesis is unsupported", () => {
    // window.speechSynthesis stays absent (default from beforeEach).
    expect(() => stopSpeaking()).not.toThrow();
  });
});
