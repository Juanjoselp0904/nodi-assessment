"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Volume2, CheckCircle, Loader2 } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import { api, NextQuestionResponse } from "@/lib/api";

type Stage = "loading" | "playing" | "waiting_answer" | "submitting" | "finished" | "error";

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const [stage, setStage] = useState<Stage>("loading");
  const [question, setQuestion] = useState<NextQuestionResponse | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchNextQuestion = useCallback(async () => {
    setStage("loading");
    try {
      const q = await api.nextQuestion(sessionId);
      if (q.finished) {
        setStage("finished");
        return;
      }
      setQuestion(q);
      setStage("playing");
    } catch {
      setError("Error al cargar la siguiente pregunta.");
      setStage("error");
    }
  }, [sessionId]);

  useEffect(() => {
    fetchNextQuestion();
  }, [fetchNextQuestion]);

  // Auto-play TTS audio when a new question arrives
  useEffect(() => {
    if (stage !== "playing") return;
    if (!question?.audio_url) {
      // No TTS audio available — skip directly to recording
      setStage("waiting_answer");
      return;
    }
    const audio = new Audio(question.audio_url);
    audioRef.current = audio;
    audio.onended = () => setStage("waiting_answer");
    audio.onerror = () => setStage("waiting_answer"); // fallback: allow answering even if TTS fails
    audio.play().catch(() => setStage("waiting_answer"));
    return () => {
      audio.pause();
    };
  }, [stage, question?.audio_url]);

  const handleRecordingComplete = async (blob: Blob) => {
    if (!question?.id) return;
    setStage("submitting");
    try {
      await api.submitAnswer(sessionId, question.id, blob);
      setAnsweredCount((c) => c + 1);
      await fetchNextQuestion();
    } catch {
      setError("Error al enviar tu respuesta. Intenta de nuevo.");
      setStage("waiting_answer");
    }
  };

  const replayAudio = () => {
    if (!question?.audio_url) return;
    audioRef.current?.pause();
    const audio = new Audio(question.audio_url);
    audioRef.current = audio;
    audio.play().catch(() => {});
  };

  if (stage === "finished") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
        <CheckCircle className="w-16 h-16 text-green-400" />
        <h1 className="text-3xl font-bold">¡Entrevista completada!</h1>
        <p className="text-gray-400 max-w-md">
          Gracias por tu tiempo. El reclutador recibirá un análisis detallado de tus respuestas.
        </p>
        <Link href="/" className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (stage === "error") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchNextQuestion}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors"
        >
          Reintentar
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-sm text-gray-500">
            Pregunta {answeredCount + 1}
          </span>
          {question?.dimension && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                question.dimension === "tech"
                  ? "bg-blue-900/50 text-blue-300"
                  : "bg-purple-900/50 text-purple-300"
              }`}
            >
              {question.dimension === "tech" ? "Técnica" : "Cultura"}
              {question.kind === "probe" && " · profundización"}
            </span>
          )}
        </div>

        {/* Question card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8 min-h-32 flex flex-col gap-4">
          {(stage === "loading" || stage === "submitting") ? (
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">
                {stage === "submitting" ? "Procesando tu respuesta..." : "Preparando siguiente pregunta..."}
              </span>
            </div>
          ) : (
            <>
              <p className="text-lg leading-relaxed text-gray-100">{question?.text}</p>
              {stage === "playing" && (
                <div className="flex items-center gap-2 text-xs text-indigo-400">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  Escuchando pregunta...
                </div>
              )}
              {stage === "waiting_answer" && (
                <button
                  onClick={replayAudio}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-fit"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Repetir audio
                </button>
              )}
            </>
          )}
        </div>

        {/* Recorder */}
        <div className="flex justify-center">
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            disabled={stage !== "waiting_answer"}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mt-4">{error}</p>
        )}
      </div>
    </main>
  );
}
