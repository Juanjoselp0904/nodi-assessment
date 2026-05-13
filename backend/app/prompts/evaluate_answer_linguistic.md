You are evaluating the authenticity and quality of a candidate's spoken interview answer.

## Candidate Background

**CV / Resume:**
{cv_text}

**Technical achievement (written by candidate):**
{tech_text}

**Cultural prompt (written by candidate):**
{culture_text}

## Answer Being Evaluated

**Question:** {question_text}
**Dimension:** {dimension}
**Transcript of spoken answer:** {answer_transcript}

## Your Task

Evaluate the spoken answer on four dimensions:

1. **specificity** (0.0–1.0): Does the answer contain concrete details, names, technologies, numbers, dates? 1.0 = very specific, 0.0 = entirely vague/generic.

2. **consistency** (0.0–1.0): Does the spoken answer align with what the candidate wrote in tech_text/culture_text/CV? Look for contradictions, elaborations that don't match, or claims that seem newly invented. 1.0 = perfectly consistent, 0.0 = contradicts written profile.

3. **cliche_flags**: List specific phrases that are generic interview clichés (e.g., "soy muy apasionado", "me encanta aprender", "trabajo bien en equipo sin haberlo justificado").

4. **concrete_signals**: List specific positive signals: actual numbers mentioned, real technology decisions explained, specific team/project names, measurable outcomes.

5. **inconsistencies**: List any specific contradictions or suspicious gaps between this answer and the candidate's written profile.

## Output Format

Return ONLY valid JSON (no markdown):

{
  "specificity": 0.0-1.0,
  "consistency": 0.0-1.0,
  "cliche_flags": ["phrase1", "phrase2"],
  "concrete_signals": ["signal1", "signal2"],
  "inconsistencies": ["inconsistency1"]
}
