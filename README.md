# Nodi — Plataforma de entrevistas adaptativas por voz

## Stack

- **Backend**: FastAPI + SQLModel (SQLite) + Python 3.11+
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **STT**: OpenAI Whisper API
- **TTS**: Google Cloud Text-to-Speech
- **LLM**: Gemini API (Google AI Studio)
- **Análisis acústico**: librosa

---

## Setup rápido

### 1. API keys necesarias

| Key | Dónde obtenerla |
|-----|-----------------|
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `GOOGLE_API_KEY` | aistudio.google.com → Get API key (Gemini, gratis) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud Console → Service Account JSON (para TTS) |

### 2. Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus keys

# Con uv (recomendado):
uv sync
uv run uvicorn app.main:app --reload

# O con pip:
pip install -e .
uvicorn app.main:app --reload
```

El servidor corre en `http://localhost:8000`.

### 3. Frontend

```bash
cd frontend
pnpm install   # o npm install
pnpm dev
```

El frontend corre en `http://localhost:3000`.

---

## Flujo de uso

1. **Candidato** → `/candidate/intake`: llena nombre, logro técnico y prompt cultural → el sistema genera preguntas personalizadas.
2. **Candidato** → `/candidate/interview/{id}`: escucha cada pregunta por voz (TTS) y graba su respuesta. El sistema puede insertar preguntas de profundización (probes) según las respuestas.
3. **Reclutador** → `/recruiter`: ve el listado de entrevistas con scores.
4. **Reclutador** → `/recruiter/{id}`: genera evaluación final → ve fit técnico, fit cultural, factor de naturalidad (×0.5–1.2), evidencia citada y análisis del modelo.

---

## Módulo de naturalidad (diferenciador)

El factor de naturalidad (`×0.5–1.2`) multiplica los scores base:

```
combined = 0.7 × linguistic_score + 0.3 × acoustic_score
naturalness_factor = 0.5 + 0.7 × combined

final_tech_fit    = tech_score × naturalness_factor
final_culture_fit = culture_score × naturalness_factor
```

**Lingüístico** (LLM): especificidad, consistencia con HV/textos iniciales, detección de clichés.  
**Acústico** (librosa): ratio de pausas, velocidad del habla, varianza de energía, densidad de fillers.

---

## Estructura

```
backend/app/
  api/          → routers FastAPI
  services/     → STT, TTS, LLM, naturalness, interview_engine
  prompts/      → plantillas de prompts en Markdown
  models.py     → SQLModel schemas
  main.py       → FastAPI app

frontend/
  app/          → Next.js App Router (candidate + recruiter)
  components/   → VoiceRecorder, EvidenceCard, NaturalnessBreakdown
  lib/api.ts    → cliente HTTP tipado
```
