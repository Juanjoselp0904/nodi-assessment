import { ThumbsUp, ThumbsDown, HelpCircle } from "lucide-react";

interface Props {
  recommendation?: "yes" | "no" | "maybe" | string;
  reason?: string;
  size?: "sm" | "md" | "lg";
}

const STYLES: Record<string, { color: string; label: string; Icon: typeof ThumbsUp }> = {
  yes:   { color: "text-green-400 bg-green-900/40 border-green-900",   label: "Contratar",    Icon: ThumbsUp },
  no:    { color: "text-red-400 bg-red-900/40 border-red-900",         label: "No contratar", Icon: ThumbsDown },
  maybe: { color: "text-yellow-400 bg-yellow-900/40 border-yellow-900", label: "Tal vez",     Icon: HelpCircle },
};

export default function HireBadge({ recommendation, reason, size = "sm" }: Props) {
  if (!recommendation) return <span className="text-gray-600 text-xs">—</span>;
  const style = STYLES[recommendation];
  if (!style) return <span className="text-gray-600 text-xs">{recommendation}</span>;

  const sizing = {
    sm: { pad: "px-2 py-0.5 text-xs", icon: "w-3 h-3" },
    md: { pad: "px-3 py-1 text-sm", icon: "w-4 h-4" },
    lg: { pad: "px-4 py-1.5 text-base", icon: "w-5 h-5" },
  }[size];

  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${style.color} ${sizing.pad} w-fit`}>
        <style.Icon className={sizing.icon} />
        {style.label}
      </span>
      {reason && size !== "sm" && (
        <span className="text-xs text-gray-500 italic max-w-md">{reason}</span>
      )}
    </div>
  );
}
