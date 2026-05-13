import { EvidenceItem } from "@/lib/api";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  items: EvidenceItem[];
  dimension: "tech" | "culture";
  qaDetail: {
    question_id: number;
    question_text: string;
    answer_id?: number;
    transcript?: string;
    audio_path?: string;
  }[];
}

export default function EvidenceCard({ items, dimension, qaDetail }: Props) {
  const filtered = items.filter((i) => i.dimension === dimension);

  if (filtered.length === 0) {
    return <p className="text-gray-600 text-sm">No se registró evidencia para esta dimensión.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {filtered.map((item, idx) => {
        const qa = qaDetail[item.answer_index];
        return (
          <div
            key={idx}
            className={`rounded-xl border p-4 ${
              item.type === "positive"
                ? "border-green-900/50 bg-green-950/30"
                : "border-orange-900/50 bg-orange-950/20"
            }`}
          >
            <div className="flex items-start gap-2 mb-2">
              {item.type === "positive" ? (
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-200">{item.claim}</p>
                <span
                  className={`text-xs ${
                    item.confidence === "high" ? "text-gray-500" : "text-gray-600"
                  }`}
                >
                  Confianza: {item.confidence}
                </span>
              </div>
            </div>
            {item.supporting_quote && (
              <blockquote className="text-sm text-gray-400 italic border-l-2 border-gray-700 pl-3 mt-2">
                &ldquo;{item.supporting_quote}&rdquo;
              </blockquote>
            )}
            {qa?.question_text && (
              <p className="text-xs text-gray-600 mt-2">
                Pregunta: {qa.question_text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
