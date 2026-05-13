"use client";
import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

type RecorderState = "idle" | "recording" | "processing";

interface Props {
  onRecordingComplete: (blob: Blob) => Promise<void>;
  disabled?: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, disabled }: Props) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setState("processing");
      await onRecordingComplete(blob);
      setState("idle");
      setSeconds(0);
    };

    mr.start(250);
    setState("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (state === "processing") {
    return (
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-sm text-gray-400">Procesando respuesta...</p>
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
            <Mic className="w-7 h-7 text-white" />
          </div>
        </div>
        <p className="text-sm text-gray-400 tabular-nums">{fmt(seconds)}</p>
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-full font-medium transition-colors"
        >
          <Square className="w-4 h-4" /> Terminar respuesta
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-full font-medium transition-colors"
    >
      <Mic className="w-5 h-5" /> Grabar respuesta
    </button>
  );
}
