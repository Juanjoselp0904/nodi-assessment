const BASE = "/api";

export interface CreateSessionPayload {
  candidate_name: string;
  cv_text?: string;
  tech_text: string;
  culture_text: string;
}

export interface SessionResponse {
  id: number;
  candidate_name: string;
  status: string;
}

export interface QuestionOut {
  id: number;
  order: number;
  dimension: "tech" | "culture";
  kind: "base" | "probe";
  text: string;
  audio_url: string;
  is_last: boolean;
}

export interface NextQuestionResponse {
  finished?: boolean;
  id?: number;
  order?: number;
  dimension?: string;
  kind?: string;
  text?: string;
  audio_url?: string;
  is_last?: boolean;
}

export interface AnswerOut {
  answer_id: number;
  question_id: number;
  transcript: string;
}

export interface EvidenceItem {
  dimension: string;
  claim: string;
  supporting_quote: string;
  answer_index: number;
  confidence: string;
  type: "positive" | "concern";
}

export interface EvaluationData {
  tech_score: number;
  culture_score: number;
  naturalness_factor: number;
  final_tech_fit: number;
  final_culture_fit: number;
  evidence: EvidenceItem[];
  reasoning_md: string;
  acoustic_summary: Record<string, unknown>;
  linguistic_summary: Record<string, unknown>;
}

export interface ReportData {
  session: {
    id: number;
    candidate_name: string;
    status: string;
    created_at: string;
    cv_text?: string;
    tech_text: string;
    culture_text: string;
  };
  qa_detail: {
    question_id: number;
    question_text: string;
    dimension: string;
    kind: string;
    answer_id?: number;
    transcript?: string;
    audio_path?: string;
    acoustic_features?: Record<string, number>;
    linguistic_analysis?: {
      specificity: number;
      consistency: number;
      cliche_flags: string[];
      concrete_signals: string[];
      inconsistencies: string[];
    };
  }[];
  evaluation?: EvaluationData;
}

export interface SessionListItem {
  id: number;
  candidate_name: string;
  status: string;
  tech_fit?: number;
  culture_fit?: number;
  naturalness_factor?: number;
  created_at: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

export const api = {
  createSession: (payload: CreateSessionPayload) =>
    post<SessionResponse>("/sessions", payload),

  nextQuestion: (sessionId: number) =>
    get<NextQuestionResponse>(`/sessions/${sessionId}/next-question`),

  submitAnswer: async (sessionId: number, questionId: number, audioBlob: Blob): Promise<AnswerOut> => {
    const form = new FormData();
    form.append("question_id", String(questionId));
    form.append("audio", audioBlob, "answer.webm");
    const res = await fetch(`${BASE}/sessions/${sessionId}/answer`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    return res.json();
  },

  finalizeSession: (sessionId: number) =>
    post<unknown>(`/recruiter/sessions/${sessionId}/finalize`, {}),

  listSessions: () =>
    get<SessionListItem[]>("/recruiter/sessions"),

  getReport: (sessionId: number) =>
    get<ReportData>(`/recruiter/sessions/${sessionId}/report`),
};
