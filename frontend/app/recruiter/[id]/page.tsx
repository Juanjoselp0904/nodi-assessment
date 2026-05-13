"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { api, ReportData } from "@/lib/api";
import EvidenceCard from "@/components/EvidenceCard";
import NaturalnessBreakdown from "@/components/NaturalnessBreakdown";
import HireBadge from "@/components/HireBadge";
import RecruiterChat from "@/components/RecruiterChat";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

function ScoreRing({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? "#22c55e" : value >= 0.5 ? "#eab308" : "#ef4444";
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="49" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
          {pct}%
        </text>
      </svg>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getReport(sessionId);
      setReport(data);
    } catch {
      setError("Error al cargar el reporte.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [sessionId]);

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await api.finalizeSession(sessionId);
      await loadReport();
    } catch (e) {
      setError("Error al finalizar la evaluación. " + String(e));
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen flex items-center justify-center text-red-400">
        {error || "Reporte no encontrado."}
      </main>
    );
  }

  const { session, qa_detail, evaluation } = report;
  const needsEvaluation = !evaluation && (session.status === "finished" || session.status === "in_progress");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Nav */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/recruiter" className="text-gray-500 hover:text-gray-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">{session.candidate_name}</h1>
        <StatusBadge status={session.status} />
      </div>

      {/* Scores header */}
      {evaluation ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 flex flex-col gap-6">
          {evaluation.hire_recommendation && (
            <div className="flex justify-center">
              <HireBadge
                recommendation={evaluation.hire_recommendation}
                reason={evaluation.recommendation_reason}
                size="lg"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-around gap-6">
            <ScoreRing value={evaluation.final_tech_fit} label="Fit técnico final" />
            <ScoreRing value={evaluation.final_culture_fit} label="Fit cultural final" />
            <div className="flex flex-col items-center gap-2">
              <span className={`text-3xl font-bold tabular-nums ${
                evaluation.naturalness_factor >= 1.0 ? "text-green-400" :
                evaluation.naturalness_factor >= 0.8 ? "text-yellow-400" : "text-red-400"
              }`}>×{evaluation.naturalness_factor.toFixed(2)}</span>
              <span className="text-xs text-gray-500">Factor naturalidad</span>
            </div>
            <div className="flex flex-col gap-1 text-xs text-gray-500">
              <span>Base técnico: {Math.round(evaluation.tech_score * 100)}%</span>
              <span>Base cultural: {Math.round(evaluation.culture_score * 100)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 text-center">
          {needsEvaluation ? (
            <>
              <p className="text-gray-400 mb-4">
                La entrevista está lista para ser evaluada.
              </p>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 rounded-lg text-sm font-medium transition-colors"
              >
                {finalizing ? <><Loader2 className="w-4 h-4 animate-spin" /> Evaluando...</> : <><RefreshCw className="w-4 h-4" /> Generar evaluación</>}
              </button>
            </>
          ) : (
            <p className="text-gray-600 text-sm">La entrevista aún no ha finalizado.</p>
          )}
        </div>
      )}

      {evaluation && (
        <div className="flex flex-col gap-8">
          {/* AI chat */}
          <Section title="Chat con la IA">
            <RecruiterChat sessionId={sessionId} candidateName={session.candidate_name} />
          </Section>

          {/* Reasoning */}
          {evaluation.reasoning_md && (
            <Section title="Análisis del modelo">
              <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                <ReactMarkdown>{evaluation.reasoning_md}</ReactMarkdown>
              </div>
            </Section>
          )}

          {/* Technical evidence */}
          <Section title="Evidencia técnica">
            <EvidenceCard items={evaluation.evidence} dimension="tech" qaDetail={qa_detail} />
          </Section>

          {/* Cultural evidence */}
          <Section title="Evidencia cultural">
            <EvidenceCard items={evaluation.evidence} dimension="culture" qaDetail={qa_detail} />
          </Section>

          {/* Naturalness breakdown */}
          <NaturalnessBreakdown
            naturalnessFactor={evaluation.naturalness_factor}
            acousticSummary={evaluation.acoustic_summary as never}
            linguisticSummary={evaluation.linguistic_summary as never}
          />
        </div>
      )}

      {/* Q&A transcript */}
      <Section title="Transcripción de la entrevista" className="mt-8">
        <div className="flex flex-col gap-4">
          {qa_detail.map((qa) => (
            <div key={qa.question_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  qa.dimension === "tech" ? "bg-blue-900/50 text-blue-300" : "bg-purple-900/50 text-purple-300"
                }`}>
                  {qa.dimension === "tech" ? "Técnica" : "Cultura"}
                  {qa.kind === "probe" && " · probe"}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-200 mb-2">{qa.question_text}</p>
              {qa.transcript ? (
                <p className="text-sm text-gray-400 italic">&ldquo;{qa.transcript}&rdquo;</p>
              ) : (
                <p className="text-xs text-gray-600">Sin respuesta</p>
              )}
              {qa.audio_path && (
                <audio
                  controls
                  src={qa.audio_path}
                  className="mt-2 w-full h-8 opacity-70 hover:opacity-100 transition-opacity"
                />
              )}
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    intake: { label: "Inicio", color: "text-gray-400 bg-gray-800" },
    in_progress: { label: "En curso", color: "text-blue-400 bg-blue-900/40" },
    finished: { label: "Finalizada", color: "text-yellow-400 bg-yellow-900/40" },
    evaluated: { label: "Evaluada", color: "text-green-400 bg-green-900/40" },
  };
  const { label, color } = map[status] ?? { label: status, color: "text-gray-400 bg-gray-800" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}
