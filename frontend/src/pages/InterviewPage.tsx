import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Button, ButtonLink } from "@components/ui/Button";
import { LogoMark } from "@components/ui/Logo";
import { MicIcon, ReplayIcon, SpeakerIcon, SpeakerMuteIcon } from "@components/ui/icons";
import { Spinner } from "@components/ui/Spinner";
import { cn } from "@lib/cn";
import { readSessionDraft, readVacancyDraft, type VacancyDraft } from "@lib/interview-draft";
import {
  getSession,
  submitAnswer,
  InterviewError,
  type InterviewQuestion,
  type InterviewSession,
} from "@lib/interview-api";
import {
  createRecognizer,
  isSpeechRecognitionSupported,
  speak,
  stopSpeaking,
} from "@lib/speech";
import { useTtsPreference } from "@lib/tts-preference";
import { questionKinds } from "@components/interview/question-kinds";
import { paths, reportPath } from "@routes/paths";

interface ChatEntry {
  from: "ai" | "user";
  question?: InterviewQuestion;
  text: string;
}

const MAX_TEXTAREA_HEIGHT = 160;

const CLOSING_TEXT =
  "É isso — entrevista concluída! Analisei suas respostas contra a vaga e seu relatório está pronto. Spoiler: você foi melhor do que imagina.";

export function InterviewPage() {
  const { sessionId: historicalId } = useParams<{ sessionId?: string }>();

  const [sessionDraft] = useState(() => (historicalId ? { id: historicalId } : readSessionDraft()));
  const [vacancy] = useState<VacancyDraft | null>(historicalId ? null : readVacancyDraft());

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loadError, setLoadError] = useState<InterviewError | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<InterviewError | null>(null);

  const [ttsEnabled, setTtsEnabled] = useTtsPreference();
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const micSupported = useMemo(() => isSpeechRecognitionSupported(), []);

  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const recognizerRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const draftAtRecordStartRef = useRef("");

  useEffect(() => {
    if (!sessionDraft) return;
    let cancelled = false;

    getSession(sessionDraft.id)
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLoadError(
          cause instanceof InterviewError
            ? cause
            : new InterviewError("Não foi possível carregar a entrevista."),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [sessionDraft]);

  const questions = useMemo(() => session?.questions ?? [], [session]);
  const currentIndex = questions.findIndex((q) => !q.answer);
  const finished = questions.length > 0 && currentIndex === -1;
  const currentQuestion = finished ? undefined : questions[currentIndex];

  const entries = useMemo<ChatEntry[]>(() => {
    const result: ChatEntry[] = [];

    questions.forEach((question, index) => {
      if (finished || index <= currentIndex) {
        result.push({ from: "ai", question, text: question.content });
      }
      if (question.answer) {
        result.push({ from: "user", text: question.answer.content });
      }
    });

    if (finished) {
      result.push({ from: "ai", text: CLOSING_TEXT });
    }

    return result;
  }, [questions, currentIndex, finished]);

  useEffect(() => {
    const element = chatRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries, submitting]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [draft]);

  useEffect(() => {
    if (!ttsEnabled || !currentQuestion) return;
    if (lastSpokenIdRef.current === currentQuestion.id) return;

    lastSpokenIdRef.current = currentQuestion.id;
    setSpeaking(true);
    void speak(currentQuestion.content).finally(() => setSpeaking(false));
  }, [ttsEnabled, currentQuestion]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const toggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    if (!next) stopSpeaking();
  };

  const repeatQuestion = () => {
    if (!currentQuestion || speaking) return;
    setSpeaking(true);
    void speak(currentQuestion.content).finally(() => setSpeaking(false));
  };

  const toggleRecording = () => {
    if (recording) {
      recognizerRef.current?.stop();
      return;
    }

    setMicError(null);
    stopSpeaking();
    draftAtRecordStartRef.current = draft;

    const recognizer = createRecognizer({
      onResult: (text, isFinal) => {
        if (!isFinal) return;
        const base = draftAtRecordStartRef.current;
        setDraft(base ? `${base} ${text}` : text);
        draftAtRecordStartRef.current = base ? `${base} ${text}` : text;
      },
      onEnd: () => setRecording(false),
      onError: (reason) => {
        setRecording(false);
        setMicError(
          reason === "not-allowed" || reason === "permission-denied"
            ? "Permissão de microfone negada."
            : "Não conseguimos reconhecer sua fala. Tente novamente.",
        );
      },
    });

    recognizerRef.current = recognizer;
    setRecording(true);
    recognizer.start();
  };

  const send = async () => {
    const answer = draft.trim();
    if (!answer || submitting || !session || !currentQuestion) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await submitAnswer(session.id, currentQuestion.id, answer);
      setDraft("");
      setSession((current) => {
        if (!current) return current;
        return {
          ...current,
          questions: current.questions.map((q) =>
            q.id === currentQuestion.id
              ? { ...q, answer: { content: answer, createdAt: new Date().toISOString() } }
              : q,
          ),
        };
      });
    } catch (cause: unknown) {
      setSubmitError(
        cause instanceof InterviewError
          ? cause
          : new InterviewError("Não conseguimos enviar sua resposta."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  if (!historicalId && (!vacancy || !sessionDraft)) {
    return <Navigate to={paths.newInterview} replace />;
  }

  return (
    <div className="flex h-full flex-col">
      {loadError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-[15px] text-fg-2">{loadError.detail}</p>
          {loadError.hint && <p className="font-mono text-[12.5px] text-fg-muted">{loadError.hint}</p>}
          <ButtonLink to={historicalId ? paths.dashboard : paths.repoChooser} variant="secondary">
            Voltar
          </ButtonLink>
        </div>
      )}

      {!loadError && !session && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner label="Carregando entrevista..." />
        </div>
      )}

      {!loadError && session && (
        <>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-5 sm:py-7">
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
              {entries.map((entry, index) => (
                <ChatMessage
                  key={index}
                  entry={entry}
                  isCurrentQuestion={Boolean(currentQuestion) && entry.question?.id === currentQuestion?.id}
                  ttsEnabled={ttsEnabled}
                  onRepeat={repeatQuestion}
                  repeatDisabled={speaking}
                />
              ))}
              {submitting && <TypingBubble />}
            </div>
          </div>

          <div className="flex-none border-t border-border bg-bg px-4 pt-3.5 pb-4.5 sm:px-5">
            <div className="mx-auto w-full max-w-[760px]">
              {finished ? (
                <div className="flex flex-col-reverse items-center gap-3 py-1.5 sm:flex-row sm:flex-wrap sm:justify-center">
                  <ButtonLink to={reportPath(session.id)} className="max-sm:w-full">
                    Ver meu relatório →
                  </ButtonLink>
                  <ButtonLink to={paths.dashboard} variant="secondary" className="max-sm:w-full">
                    Voltar ao dashboard
                  </ButtonLink>
                </div>
              ) : (
                <>
                  {submitError && (
                    <p className="mb-2.5 text-[13px] text-danger">
                      {submitError.detail}
                      {submitError.hint ? ` ${submitError.hint}` : ""}
                    </p>
                  )}

                  {micError && <p className="mb-2.5 text-[13px] text-danger">{micError}</p>}

                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="Digite sua resposta — sem pressa…"
                      aria-label="Sua resposta"
                      rows={2}
                      disabled={submitting}
                      className="order-1 max-h-[160px] w-full resize-none overflow-y-auto rounded-xl border border-border bg-surface px-4 py-3.5 text-[15px] leading-[1.5] text-fg transition-[border-color,box-shadow] duration-200 focus:border-trail-500 focus:shadow-[0_0_0_3px_--alpha(var(--color-trail-500)/20%)] focus:outline-none sm:order-2 sm:min-w-0 sm:flex-1"
                    />

                    <div className="order-2 flex items-center justify-between gap-2.5 sm:contents">
                      <div className="flex items-center gap-2.5 sm:contents">
                        <button
                          type="button"
                          onClick={toggleTts}
                          aria-pressed={ttsEnabled}
                          aria-label={
                            ttsEnabled
                              ? "Desativar leitura das perguntas em voz alta"
                              : "Ativar leitura das perguntas em voz alta"
                          }
                          title={ttsEnabled ? "Leitura em voz alta ativada" : "Leitura em voz alta desativada"}
                          className={cn(
                            "flex size-12 flex-none items-center justify-center rounded-[12px] border transition-colors duration-200 sm:order-1",
                            ttsEnabled
                              ? "border-trail-500 bg-[--alpha(var(--color-trail-500)/13%)] text-trail-text"
                              : "border-border bg-surface text-fg-2 hover:text-fg",
                          )}
                        >
                          {ttsEnabled ? <SpeakerIcon size={17} /> : <SpeakerMuteIcon size={17} />}
                        </button>
                        <button
                          type="button"
                          onClick={toggleRecording}
                          disabled={!micSupported || submitting}
                          aria-label={recording ? "Parar gravação" : "Responder por voz"}
                          title={
                            micSupported
                              ? recording
                                ? "Parar gravação"
                                : "Responder por voz"
                              : "Reconhecimento de voz não é suportado neste navegador."
                          }
                          className={cn(
                            "flex size-12 flex-none items-center justify-center rounded-[12px] border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45 sm:order-3",
                            recording
                              ? "animate-pulse border-danger bg-[--alpha(var(--color-danger)/13%)] text-danger"
                              : "border-border bg-surface text-fg-2 hover:text-fg",
                          )}
                        >
                          <MicIcon size={18} />
                        </button>
                      </div>

                      <Button
                        onClick={() => void send()}
                        disabled={!draft.trim() || submitting}
                        aria-label="Enviar resposta"
                        className="size-12 flex-none rounded-[12px]! p-0! sm:order-4"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                          <path
                            d="M9 14V4M5 8l4-4 4 4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Button>
                    </div>
                  </div>

                  <p className="mt-2 px-0.5 font-mono text-[10.5px] text-fg-muted">
                    enter envia · shift+enter quebra linha
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InterviewerAvatar() {
  return (
    <span
      aria-label="Entrevistador IA"
      className="mt-0.5 flex size-[30px] flex-none items-center justify-center rounded-full border border-[--alpha(var(--color-trail-500)/40%)] bg-surface"
    >
      <LogoMark size={15} />
    </span>
  );
}

function ChatMessage({
  entry,
  isCurrentQuestion,
  ttsEnabled,
  onRepeat,
  repeatDisabled,
}: {
  entry: ChatEntry;
  isCurrentQuestion: boolean;
  ttsEnabled: boolean;
  onRepeat: () => void;
  repeatDisabled: boolean;
}) {
  if (entry.from === "user") {
    return (
      <div className="flex animate-rise justify-end">
        <p className="max-w-[88%] rounded-[14px_4px_14px_14px] sm:max-w-[82%] border border-[--alpha(var(--color-trail-500)/30%)] bg-[--alpha(var(--color-trail-500)/12%)] px-4 py-3.5 text-[15px] leading-[1.6]">
          {entry.text}
        </p>
      </div>
    );
  }

  const kind = entry.question ? questionKinds[entry.question.type] : null;
  const metadata = entry.question?.metadata;

  return (
    <div className="flex animate-rise items-start gap-3">
      <InterviewerAvatar />

      <div className="flex min-w-0 max-w-[calc(100%-42px)] flex-col gap-2 sm:max-w-[82%]">
        {kind && (
          <span
            className="self-start rounded-sm px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.06em] uppercase"
            style={{ color: kind.color, background: kind.background }}
          >
            {kind.label}
          </span>
        )}

        {metadata?.codeExcerpt && (
          <div className="overflow-hidden rounded-md border border-code-border bg-code">
            {metadata.codeFile && (
              <p className="border-b border-code-border px-3.5 py-2 font-mono text-[11px] text-fg-muted">
                {metadata.codeFile}
              </p>
            )}
            <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.7] text-slate-300">
              {metadata.codeExcerpt}
            </pre>
          </div>
        )}

        <p className="rounded-[4px_14px_14px_14px] border border-border bg-surface px-4 py-3.5 text-[15px] leading-[1.6]">
          {entry.text}
        </p>

        {isCurrentQuestion && ttsEnabled && (
          <button
            type="button"
            onClick={onRepeat}
            disabled={repeatDisabled}
            aria-label="Repetir a pergunta em voz alta"
            className="flex self-start items-center gap-1.5 rounded-full px-1 py-0.5 font-mono text-[11px] text-fg-muted transition-colors duration-200 hover:text-trail-text disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-fg-muted"
          >
            <ReplayIcon size={11} />
            repetir
          </button>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex animate-rise items-start gap-3">
      <InterviewerAvatar />
      <div
        aria-label="A IA está preparando a próxima pergunta"
        className="flex items-center gap-1.5 rounded-[4px_14px_14px_14px] border border-border bg-surface px-4.5 py-4"
      >
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: `${delay}s` }}
            className={cn("size-[7px] animate-blink rounded-full bg-fg-2")}
          />
        ))}
      </div>
    </div>
  );
}
