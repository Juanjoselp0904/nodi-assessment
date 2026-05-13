# Nodi — Plataforma de entrevistas adaptativas por voz

Sistema que automatiza entrevistas de candidatos tech mediante voz, con preguntas adaptativas generadas por IA. Evalúa **fit técnico** (qué construyó, impacto medible) y **fit cultural** (valores, vía preguntas indirectas/situacionales). Su diferenciador es un **módulo de naturalidad** que detecta respuestas memorizadas, infladas o inconsistentes con la HV — atacando el problema que tienen los ATS de premiar CVs muy adornados.

**Producción:** [nodi-assessment.vercel.app](https://nodi-assessment.vercel.app) (frontend) · backend en Railway · DB Postgres · audio en Cloudflare R2.

---

## Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Backend | FastAPI + SQLModel | Tipado fuerte, async nativo, integra bien con SDKs de IA |
| Frontend | Next.js 15 + TypeScript + Tailwind v4 | App Router, SSR opcional, ecosistema maduro |
| DB | SQLite (local) / PostgreSQL (prod) | Cero infra en dev, persistencia real en prod |
| STT | OpenAI Whisper API | Mejor calidad/precio para español, soporta word-level timestamps |
| TTS | Google Cloud Text-to-Speech | Free tier de 1M chars/mes, voces neutras decentes |
| LLM | Gemini 2.5 Flash + Pro | Free tier de AI Studio, calidad razonable para razonamiento |
| Storage audio | Cloudflare R2 (prod) / filesystem (local) | 10 GB gratis, S3-compatible |
| Análisis acústico | librosa + ffmpeg | Estándar de Python para procesamiento de audio |

---

## Correr el proyecto en local

### Requisitos

- **Python 3.11+**
- **Node 20+** y **pnpm 11** (`npm install -g pnpm@11`)
- API keys: OpenAI, Gemini (AI Studio), Google Cloud TTS

### 1. API keys

| Key | Dónde obtenerla |
|-----|-----------------|
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → API keys (requiere tarjeta, costo bajísimo) |
| `GOOGLE_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API key (Gemini, **gratis**) |
| Google Cloud TTS | Console GCP → habilita **Cloud Text-to-Speech API** → crea service account → descarga JSON |

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -e .

cp .env.example .env            # Editar con tus keys
uvicorn app.main:app --reload --port 8000
```

Backend en `http://localhost:8000` · Docs interactivas en `/docs`.

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend en `http://localhost:3000`. El `next.config.ts` hace proxy de `/api/*` y `/storage/*` al backend (puerto 8000 por default, override con `BACKEND_URL` env var).

### 4. Variables de entorno (`backend/.env`)

```bash
# LLM / STT / TTS
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=./google_service_account.json

# DB (local default: SQLite)
DATABASE_URL=sqlite:///./nodi.db

# Storage (local default: filesystem)
STORAGE_PATH=./storage
R2_BUCKET_NAME=        # dejar vacío para usar local
```

---

## Flujo de uso

1. **Candidato** → `/candidate/intake`: ingresa nombre, CV opcional, logro técnico y prompt cultural → el LLM genera 2 preguntas personalizadas cruzando los textos.
2. **Candidato** → `/candidate/interview/{id}`: escucha cada pregunta por voz (TTS) y graba su respuesta. El sistema puede insertar preguntas de profundización (*probes*) si detecta vaguedad, claims sin números o inconsistencias.
3. **Reclutador** → `/recruiter`: dashboard con tabla de candidatos, recomendación de contratación (sí/no/quizás), fit técnico, fit cultural y factor de naturalidad.
4. **Reclutador** → `/recruiter/{id}`: reporte completo. Genera evaluación final con un click → ve scores, evidencia citada textualmente del candidato, desglose del factor de naturalidad y un **chat con IA** que tiene contexto completo del candidato para responder preguntas concretas ("¿qué números mencionó sobre la migración?", "¿hubo inconsistencias con su CV?", etc).

---

## Decisiones de arquitectura


### 1. SQLite en local, PostgreSQL en producción

SQLite es perfecto para desarrollo: cero setup, archivo único. Pero en Railway el filesystem es efímero (se borra en cada redeploy), entonces producción necesita PostgreSQL. SQLModel/SQLAlchemy soportan ambos sin cambios de código — solo cambia `DATABASE_URL`.

Hay una mini-migración auto-ejecutable en `db.py` que agrega columnas faltantes al startup, para evitar tener que correr migraciones manuales con Alembic en un proyecto demo.

### 2. Storage de audio abstracto (local ↔ R2)

`storage_service.py` abstrae el backend de archivos. Si `R2_BUCKET_NAME` está definido → usa Cloudflare R2 (S3-compatible). Si no → filesystem local con `StaticFiles` de FastAPI. La capa de servicios (TTS, interview, naturalness) no sabe cuál se está usando.

### 3. Módulo de naturalidad: enfoque híbrido lite

El factor de naturalidad (`×0.5–1.2`) multiplica los scores base:

```
combined = 0.7 × linguistic_score + 0.3 × acoustic_score
naturalness_factor = 0.5 + 0.7 × combined

final_tech_fit    = tech_score × naturalness_factor
final_culture_fit = culture_score × naturalness_factor
```

**Lingüístico (70%)** — el LLM evalúa cada respuesta:
- *Especificidad*: ¿menciona números, nombres, decisiones concretas?
- *Consistencia*: ¿la respuesta de voz se alinea con lo que el candidato escribió en el intake y su CV?
- *Clichés*: detección de frases genéricas tipo "soy team player"

**Acústico (30%)** — librosa + word timestamps de Whisper:
- *Ratio de pausas* (zona sana: 10–30%)
- *Velocidad del habla* (zona sana: 1.5–4 palabras/seg en español)
- *Varianza de energía* (voces leídas son monótonas, varianza baja)
- *Densidad de fillers* ("eh", "uhm", "este", "o sea")

Cada feature se mapea a un score 0–1 vía función trapezoidal (definida en `naturalness.py`). Los scores se promedian para obtener `acoustic_score`.

**¿Por qué híbrido?** Solo lingüístico no detecta respuestas memorizadas con buena dicción; solo acústico no detecta respuestas elaboradas sin sustancia. El factor 0.5–1.2 vs 0–1 es deliberado: una entrevista muy auténtica **boostea** el score base, no solo lo penaliza.

### 4. Generación de preguntas adaptativas

El motor (`interview_engine.py`) genera un plan inicial de 2 preguntas, y entre cada respuesta llama al LLM con un prompt de "decide si necesitas probe". Si la respuesta fue vaga o le faltan números, el LLM genera una pregunta de profundización. Límites: máximo 2 probes por pregunta base y 4 preguntas totales

### 5. Evidencia citada para auditabilidad del reclutador

El LLM no solo da scores — devuelve un array de `evidence` con `claim`, `supporting_quote` (palabras textuales del candidato), `confidence` y `type` (positiva o concern). Esto permite al reclutador hacer una auditoría rápida: si la IA dice "el candidato lideró una migración crítica", debe haber una cita real del candidato diciéndolo. Si no la hay → la IA alucinó, y se detecta fácil.

### 6. Chat con IA en el dashboard del reclutador

Endpoint `POST /api/recruiter/sessions/{id}/chat` recibe historial de mensajes y devuelve respuesta del LLM. El agente tiene **todo el contexto evaluativo** del candidato (CV + textos iniciales + QAs + scores + factor naturalidad + evidencia + reasoning) precargado en el prompt. Razón: si solo le diéramos el resumen, alucinaría preguntas específicas como "qué números mencionó". Sin persistencia en DB — el historial vive en el state del browser.

### 7. Recomendación de contratación estructurada

El LLM final devuelve un `hire_recommendation` (yes/no/maybe) + `recommendation_reason` (1 frase). Esto permite filtrar candidatos rápidamente en el dashboard sin tener que leer el reasoning completo de cada uno.

---

## Suposiciones y limitaciones

1. **Idioma**: todo el flujo está en español (prompts, voces TTS, lista de fillers, mensajes UI). Soportar inglés requeriría duplicar prompts y ajustar las heurísticas acústicas del español (velocidad del habla varía por idioma).

2. **Voz natural del candidato**: el análisis acústico asume audio de un solo hablante en un ambiente razonablemente silencioso. Ruido ambiental fuerte invalidaría el análisis de energía y pausas.

3. **Honestidad del candidato sobre el CV**: el sistema valida consistencia entre lo escrito y lo hablado, pero no puede verificar claims contra fuentes externas (LinkedIn, GitHub). Si el candidato miente consistentemente, las inconsistencias no se detectarán.

4. **Sin autenticación**: la demo no tiene login para candidatos ni reclutadores. Cualquiera con la URL puede iniciar una entrevista o ver reportes. Para producción real habría que agregar Auth (Clerk, NextAuth, etc.).

5. **El LLM como juez**: los scores `tech_score` y `culture_score` son juicios del LLM, no de un humano. El reasoning y la evidencia citada existen precisamente para que el reclutador pueda invalidar el juicio cuando esté mal. No es un sistema de "auto-hire", sino de pre-screening.

6. **Costos**: cada entrevista consume ~3-4 llamadas a Gemini Flash + 1 a Gemini Pro + Whisper por cada respuesta + TTS por cada pregunta. En free tiers da para decenas de entrevistas. Para producción a escala habría que pasar a tier pago de Gemini y considerar caché agresivo de TTS (ya implementado por hash de texto).

7. **Naturalidad acústica es sensible al micrófono**: micrófonos de mala calidad o mucho hardware processing (cancelación de ruido agresiva) pueden alterar la varianza de energía y dar falsos positivos de "voz monótona".

8. **Storage de audio crece sin límite**: no hay TTL ni limpieza automática. En producción habría que agregar una política de retención (ej. borrar audios > 90 días) — Cloudflare R2 lo soporta vía lifecycle rules.

9. **Browser-only para grabación**: `MediaRecorder` API funciona en Chrome/Edge/Firefox modernos. Safari tiene historial de problemas con webm/opus.

---

## Estructura del proyecto

```
backend/
  app/
    main.py              FastAPI app + lifespan + CORS
    db.py                SQLAlchemy engine + auto-migración de columnas
    models.py            SQLModel schemas (Session, Question, Answer, Evaluation)
    api/                 Routers: sessions, interview, recruiter
    services/
      llm_service.py     Wrapper de Gemini + plantillas
      stt_service.py     Wrapper de Whisper
      tts_service.py     Wrapper de Google TTS con caché por hash
      storage_service.py Abstracción local ↔ R2
      naturalness.py     Análisis acústico + cálculo del factor
      interview_engine.py Orquesta plan inicial + probes adaptativos
    prompts/             Templates de prompts en Markdown
  Dockerfile             Para deploy en Railway
  railway.json           Config de build de Railway

frontend/
  app/
    layout.tsx           Header persistente
    page.tsx             Home
    candidate/
      intake/page.tsx           Formulario de inicio
      interview/[id]/page.tsx   UI de entrevista por voz
    recruiter/
      page.tsx           Dashboard
      [id]/page.tsx      Reporte detallado + chat
  components/
    VoiceRecorder.tsx
    EvidenceCard.tsx
    NaturalnessBreakdown.tsx
    HireBadge.tsx
    RecruiterChat.tsx
  lib/api.ts             Cliente HTTP tipado
  next.config.ts         Proxy a backend configurable
```

---

## Verificación end-to-end

Para probar el diferenciador (módulo de naturalidad), corre **dos sesiones con el mismo CV/textos**:

- **Sesión A**: respuestas concretas con números, nombres reales de tecnologías, ejemplos específicos.
- **Sesión B**: respuestas genéricas con clichés ("soy team player, me apasiona la tecnología, trabajo bien bajo presión").

El `naturalness_factor` de A debe ser claramente mayor que B (esperar ~1.0–1.2 vs ~0.6–0.8), y el desglose en el reporte debe explicar por qué cada uno subió o bajó.

---

## Despliegue

- **Frontend**: Vercel con `BACKEND_URL` apuntando a Railway.
- **Backend**: Railway con Dockerfile + Postgres plugin + variables de entorno.
- **Storage**: Cloudflare R2 (bucket público + access keys).

Detalles de variables de entorno en `backend/.env.example`.
