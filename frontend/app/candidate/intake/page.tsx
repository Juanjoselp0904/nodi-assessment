"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    candidate_name: "",
    cv_text: "",
    tech_text: "",
    culture_text: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.candidate_name.trim() || !form.tech_text.trim() || !form.culture_text.trim()) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await api.createSession(form);
      router.push(`/candidate/interview/${session.id}`);
    } catch (err) {
      setError("Error al crear la sesión. Intenta de nuevo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-1">Preparación de entrevista</h1>
        <p className="text-gray-400 mb-8">
          Responde estas preguntas para que el sistema genere una entrevista personalizada para ti.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Field label="Tu nombre completo *" htmlFor="name">
            <input
              id="name"
              type="text"
              value={form.candidate_name}
              onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
              placeholder="Ej: Juan Pérez"
              className="input-field"
            />
          </Field>

          <Field
            label="CV / Resumen profesional (opcional)"
            htmlFor="cv"
            hint="Pega tu CV en texto plano. Cuanta más información, más precisas serán las preguntas."
          >
            <textarea
              id="cv"
              rows={5}
              value={form.cv_text}
              onChange={(e) => setForm({ ...form, cv_text: e.target.value })}
              placeholder="Experiencia laboral, tecnologías, proyectos..."
              className="input-field resize-none"
            />
          </Field>

          <Field
            label="¿Cuál es el logro técnico más importante que has alcanzado? *"
            htmlFor="tech"
            hint="Sé concreto: qué construiste, qué decisiones tomaste, qué impacto tuvo (números si los recuerdas)."
          >
            <textarea
              id="tech"
              rows={5}
              value={form.tech_text}
              onChange={(e) => setForm({ ...form, tech_text: e.target.value })}
              placeholder="Ej: Rediseñé la arquitectura del servicio de pagos de monolito a microservicios, reduciendo la latencia en 40% y habilitando el procesamiento de 10,000 transacciones/minuto..."
              className="input-field resize-none"
            />
          </Field>

          <Field
            label="¿En qué ambiente de equipo has trabajado mejor — y cuándo no encajaste? *"
            htmlFor="culture"
            hint="Describe qué hacía que ese ambiente funcionara para ti, y un momento donde hubo fricción con el equipo o con una decisión, y qué aprendiste."
          >
            <textarea
              id="culture"
              rows={5}
              value={form.culture_text}
              onChange={(e) => setForm({ ...form, culture_text: e.target.value })}
              placeholder="Ej: He trabajado mejor en equipos pequeños con mucha autonomía técnica. El ambiente que más me ha funcionado es donde hay discusión abierta antes de tomar decisiones..."
              className="input-field resize-none"
            />
          </Field>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "Generando tu entrevista..." : "Comenzar entrevista →"}
          </button>
        </form>
      </div>

      <style jsx global>{`
        .input-field {
          width: 100%;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 8px;
          padding: 12px 14px;
          color: #f9fafb;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: #6366f1;
        }
        .input-field::placeholder {
          color: #6b7280;
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-200">
        {label}
      </label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </div>
  );
}
