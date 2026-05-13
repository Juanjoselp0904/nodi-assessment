"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, SessionListItem } from "@/lib/api";
import { ChevronRight, Users } from "lucide-react";

function NaturalnessBadge({ factor }: { factor?: number }) {
  if (factor == null) return <span className="text-gray-600 text-xs">—</span>;
  const color =
    factor >= 1.0 ? "text-green-400 bg-green-900/40" :
    factor >= 0.8 ? "text-yellow-400 bg-yellow-900/40" :
    "text-red-400 bg-red-900/40";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      ×{factor.toFixed(2)}
    </span>
  );
}

function ScoreBar({ value }: { value?: number }) {
  if (value == null) return <span className="text-gray-600 text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? "bg-green-500" : value >= 0.5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums">{pct}%</span>
    </div>
  );
}

export default function RecruiterPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Users className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold">Dashboard reclutador</h1>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando sesiones...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p>No hay entrevistas aún.</p>
          <Link href="/candidate/intake" className="text-indigo-400 hover:underline text-sm mt-2 inline-block">
            Enviar candidato →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-3 pr-4 font-medium">Candidato</th>
                <th className="text-left py-3 pr-4 font-medium">Estado</th>
                <th className="text-left py-3 pr-4 font-medium">Fit técnico</th>
                <th className="text-left py-3 pr-4 font-medium">Fit cultural</th>
                <th className="text-left py-3 pr-4 font-medium">Naturalidad</th>
                <th className="text-left py-3 pr-4 font-medium">Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors">
                  <td className="py-4 pr-4 font-medium text-gray-100">{s.candidate_name}</td>
                  <td className="py-4 pr-4">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="py-4 pr-4">
                    <ScoreBar value={s.tech_fit} />
                  </td>
                  <td className="py-4 pr-4">
                    <ScoreBar value={s.culture_fit} />
                  </td>
                  <td className="py-4 pr-4">
                    <NaturalnessBadge factor={s.naturalness_factor} />
                  </td>
                  <td className="py-4 pr-4 text-gray-500 tabular-nums">
                    {new Date(s.created_at).toLocaleDateString("es")}
                  </td>
                  <td className="py-4">
                    <Link href={`/recruiter/${s.id}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
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
