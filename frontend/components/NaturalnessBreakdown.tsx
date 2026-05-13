interface AcousticSummary {
  avg_acoustic_score?: number;
  per_answer?: { pause_ratio?: number; speech_rate_wps?: number; energy_variance_norm?: number; filler_density?: number; acoustic_score?: number }[];
}

interface LinguisticSummary {
  specificity_avg?: number;
  consistency_avg?: number;
  cliche_density?: number;
  linguistic_score?: number;
}

interface Props {
  naturalnessFactor: number;
  acousticSummary?: AcousticSummary;
  linguisticSummary?: LinguisticSummary;
}

function Bar({ label, value, good = true }: { label: string; value: number; good?: boolean }) {
  const pct = Math.round(value * 100);
  const color = good ? (value >= 0.7 ? "bg-green-500" : value >= 0.5 ? "bg-yellow-500" : "bg-red-500") : (value <= 0.3 ? "bg-green-500" : value <= 0.5 ? "bg-yellow-500" : "bg-red-500");
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function NaturalnessBreakdown({ naturalnessFactor, acousticSummary, linguisticSummary }: Props) {
  const factorColor =
    naturalnessFactor >= 1.0 ? "text-green-400" :
    naturalnessFactor >= 0.8 ? "text-yellow-400" :
    "text-red-400";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-200">Factor de naturalidad</h3>
        <span className={`text-2xl font-bold tabular-nums ${factorColor}`}>×{naturalnessFactor.toFixed(2)}</span>
      </div>

      <p className="text-xs text-gray-500 mb-5">
        Este factor multiplica el fit técnico y cultural. Detecta respuestas memorizadas, leídas o inconsistentes con el perfil del candidato. Rango: 0.5 (poco natural) → 1.2 (muy auténtico).
      </p>

      <div className="flex flex-col gap-6">
        {/* Linguistic */}
        {linguisticSummary && (
          <div>
            <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Análisis lingüístico (70%)</p>
            <div className="flex flex-col gap-2">
              <Bar label="Especificidad" value={linguisticSummary.specificity_avg ?? 0} />
              <Bar label="Consistencia con HV" value={linguisticSummary.consistency_avg ?? 0} />
              <Bar label="Densidad de clichés" value={1 - (linguisticSummary.cliche_density ?? 0)} />
              <Bar label="Score lingüístico" value={linguisticSummary.linguistic_score ?? 0} />
            </div>
          </div>
        )}

        {/* Acoustic */}
        {acousticSummary && typeof acousticSummary.avg_acoustic_score === "number" && (
          <div>
            <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Análisis acústico (30%)</p>
            <div className="flex flex-col gap-2">
              <Bar label="Score acústico avg" value={acousticSummary.avg_acoustic_score} />
            </div>
            {acousticSummary.per_answer && acousticSummary.per_answer.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">Ver por respuesta</summary>
                <div className="mt-2 flex flex-col gap-1">
                  {acousticSummary.per_answer.map((a, i) => (
                    <div key={i} className="text-xs text-gray-600 flex gap-4 py-1 border-b border-gray-900">
                      <span>R{i + 1}</span>
                      {a.pause_ratio != null && <span>Pausas: {(a.pause_ratio * 100).toFixed(0)}%</span>}
                      {a.speech_rate_wps != null && <span>Ritmo: {a.speech_rate_wps.toFixed(1)} pal/s</span>}
                      {a.filler_density != null && <span>Fillers: {(a.filler_density * 100).toFixed(1)}%</span>}
                      {a.acoustic_score != null && <span>Score: {(a.acoustic_score * 100).toFixed(0)}%</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
