"use client";
import { useState, useRef, useEffect } from "react";
import { api, ChatMessage } from "@/lib/api";
import { Send, Loader2, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  sessionId: number;
  candidateName: string;
}

const SUGGESTED = [
  "¿Qué números concretos mencionó?",
  "¿Hubo inconsistencias con su HV?",
  "¿Por qué la recomendación de contratación?",
  "¿Cuál fue su respuesta más débil?",
];

export default function RecruiterChat({ sessionId, candidateName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await api.chat(sessionId, newMessages);
      setMessages([...newMessages, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setError("Error al enviar el mensaje. Intenta de nuevo.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl flex flex-col h-[600px]">
      <div className="flex items-center gap-2 p-4 border-b border-gray-800">
        <MessageSquare className="w-5 h-5 text-indigo-400" />
        <div>
          <h3 className="font-semibold text-gray-200 text-sm">Chat con la IA sobre {candidateName}</h3>
          <p className="text-xs text-gray-500">Pregunta cualquier cosa sobre la entrevista. Las respuestas citan al candidato.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 mb-1">Sugerencias:</p>
            {SUGGESTED.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                className="text-left text-sm text-gray-300 bg-gray-800/50 hover:bg-gray-800 border border-gray-800 rounded-lg px-3 py-2 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-200"
            }`}>
              {m.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{m.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-2.5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm text-gray-400">Pensando...</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-gray-800 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta sobre el candidato..."
          disabled={loading}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
