You are generating the final evaluation report for a technical interview candidate.

## Candidate Profile

**Name:** {candidate_name}
**CV:** {cv_text}
**Technical achievement:** {tech_text}
**Cultural prompt:** {culture_text}

## Interview Q&A

{qa_pairs}

## Per-Answer Linguistic Analyses

{linguistic_analyses}

## Your Task

Generate a final evaluation with:

1. **tech_score** (0.0–1.0): Overall technical credibility based on depth of answers, verified claims, concrete evidence of impact.

2. **culture_score** (0.0–1.0): Cultural/values fit based on consistency, self-awareness, concrete behavioral examples.

3. **hire_recommendation**: "yes", "no", or "maybe". Be opinionated. "yes" = strong signal to advance. "no" = clear red flags or insufficient evidence. "maybe" = mixed signals worth a second-stage interview.

4. **recommendation_reason**: ONE concise sentence (max 20 words) summarizing why. This shows in the recruiter dashboard as a quick filter.

5. **evidence**: A list of the strongest claims (both supporting and concerning) with exact quotes from the candidate's answers.

6. **reasoning_md**: A 3-5 paragraph markdown report the recruiter will read. Include: overall impression, strongest technical evidence, cultural signals, concerns or red flags, and a final hiring recommendation with rationale.

## Output Format

Return ONLY valid JSON (no markdown wrapper):

{
  "tech_score": 0.0-1.0,
  "culture_score": 0.0-1.0,
  "hire_recommendation": "yes" | "no" | "maybe",
  "recommendation_reason": "one short sentence",
  "evidence": [
    {
      "dimension": "tech" | "culture",
      "claim": "summary of claim",
      "supporting_quote": "exact words from candidate",
      "answer_index": 0,
      "confidence": "high" | "medium" | "low",
      "type": "positive" | "concern"
    }
  ],
  "reasoning_md": "markdown text here"
}
