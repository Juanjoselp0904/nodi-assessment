import os
import json
import re
import time
from pathlib import Path
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

_client = None

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    return _client


def _load_prompt(filename: str) -> str:
    return (PROMPTS_DIR / filename).read_text(encoding="utf-8")


def _render_prompt(template: str, **kwargs) -> str:
    """Replace {key} placeholders without touching other curly braces (e.g. JSON examples)."""
    for key, value in kwargs.items():
        template = template.replace("{" + key + "}", str(value))
    return template


def _call_gemini(prompt: str, model: str = "gemini-2.5-flash", retries: int = 3) -> str:
    client = _get_client()
    for attempt in range(retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=4096,
                ),
            )
            return response.text
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise e


def _parse_json(text: str) -> dict | list:
    # Strip markdown code blocks if present
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = text.rstrip("`").strip()
    return json.loads(text)


def generate_interview_plan(cv_text: str, tech_text: str, culture_text: str) -> list[dict]:
    template = _load_prompt("generate_interview_plan.md")
    prompt = _render_prompt(
        template,
        cv_text=cv_text or "No CV provided.",
        tech_text=tech_text,
        culture_text=culture_text,
    )
    raw = _call_gemini(prompt, model="gemini-2.5-flash")
    data = _parse_json(raw)
    return data["questions"]


def generate_probe(
    question_text: str,
    answer_transcript: str,
    intent: str,
    expected_evidence: str,
) -> dict:
    template = _load_prompt("generate_probe.md")
    prompt = _render_prompt(
        template,
        question_text=question_text,
        answer_transcript=answer_transcript,
        intent=intent or "",
        expected_evidence=expected_evidence or "",
    )
    raw = _call_gemini(prompt, model="gemini-2.5-flash")
    return _parse_json(raw)


def evaluate_answer_linguistic(
    cv_text: str,
    tech_text: str,
    culture_text: str,
    question_text: str,
    dimension: str,
    answer_transcript: str,
) -> dict:
    template = _load_prompt("evaluate_answer_linguistic.md")
    prompt = _render_prompt(
        template,
        cv_text=cv_text or "No CV provided.",
        tech_text=tech_text,
        culture_text=culture_text,
        question_text=question_text,
        dimension=dimension,
        answer_transcript=answer_transcript,
    )
    raw = _call_gemini(prompt, model="gemini-2.5-flash")
    return _parse_json(raw)


def final_evaluation(
    candidate_name: str,
    cv_text: str,
    tech_text: str,
    culture_text: str,
    qa_pairs: list[dict],
    linguistic_analyses: list[dict],
) -> dict:
    qa_text = "\n\n".join(
        f"Q{i+1} [{qa['dimension']}]: {qa['question']}\nA: {qa['transcript']}"
        for i, qa in enumerate(qa_pairs)
    )
    la_text = "\n\n".join(
        f"Answer {i+1} analysis: {json.dumps(la, ensure_ascii=False)}"
        for i, la in enumerate(linguistic_analyses)
    )
    template = _load_prompt("final_evaluation.md")
    prompt = _render_prompt(
        template,
        candidate_name=candidate_name,
        cv_text=cv_text or "No CV provided.",
        tech_text=tech_text,
        culture_text=culture_text,
        qa_pairs=qa_text,
        linguistic_analyses=la_text,
    )
    raw = _call_gemini(prompt, model="gemini-2.5-pro")
    return _parse_json(raw)
