from sqlmodel import Session, select
from app.models import InterviewSession, Question, Answer, QuestionDimension, QuestionKind, SessionStatus
from app.services import llm_service, tts_service
import json
import logging

logger = logging.getLogger(__name__)


def _safe_synthesize(text: str) -> str | None:
    try:
        return tts_service.synthesize(text)
    except Exception as e:
        logger.warning(f"TTS failed (continuing without audio): {e}")
        return None


def initialize_session(db: Session, session: InterviewSession) -> list[Question]:
    """Generate base questions for a new session and persist them."""
    questions_data = llm_service.generate_interview_plan(
        cv_text=session.cv_text or "",
        tech_text=session.tech_text,
        culture_text=session.culture_text,
    )

    questions = []
    for i, q_data in enumerate(questions_data):
        audio_url = _safe_synthesize(q_data["text"])
        question = Question(
            session_id=session.id,
            order=i,
            dimension=QuestionDimension(q_data["dimension"]),
            kind=QuestionKind.base,
            text=q_data["text"],
            audio_url=audio_url,
            intent=q_data.get("intent"),
            expected_evidence=q_data.get("expected_evidence"),
        )
        db.add(question)
        questions.append(question)

    session.status = SessionStatus.in_progress
    db.add(session)
    db.commit()
    for q in questions:
        db.refresh(q)
    return questions


def get_next_question(db: Session, session_id: int) -> Question | None:
    """
    Returns the next unanswered question, potentially inserting a probe.
    Respects max 2 probes per base question and max 12 questions total.
    """
    session = db.get(InterviewSession, session_id)
    if not session:
        return None

    questions = db.exec(
        select(Question)
        .where(Question.session_id == session_id)
        .order_by(Question.order)
    ).all()

    total = len(questions)

    for q in questions:
        if not q.answered:
            return q

    # All answered — check if we should add a probe for the last base question
    if total >= 2:
        return None

    last_answered = [q for q in questions if q.answered]
    if not last_answered:
        return None

    last_q = max(last_answered, key=lambda x: x.order)

    # Count probes already added for this base question
    probes_for_last = [
        q for q in questions
        if q.derived_from_answer_id is not None and q.kind == QuestionKind.probe
        and q.order > last_q.order
    ]
    if len(probes_for_last) >= 2:
        return None

    # Try generating a probe
    answer = db.exec(
        select(Answer).where(Answer.question_id == last_q.id)
    ).first()
    if not answer or not answer.transcript:
        return None

    probe_data = llm_service.generate_probe(
        question_text=last_q.text,
        answer_transcript=answer.transcript,
        intent=last_q.intent or "",
        expected_evidence=last_q.expected_evidence or "",
    )

    if not probe_data.get("needs_probe"):
        return None

    probe_text = probe_data["probe_question"]
    audio_url = _safe_synthesize(probe_text)

    next_order = max(q.order for q in questions) + 1
    probe = Question(
        session_id=session_id,
        order=next_order,
        dimension=last_q.dimension,
        kind=QuestionKind.probe,
        text=probe_text,
        audio_url=audio_url,
        intent="Probe: " + probe_data.get("reason", ""),
        derived_from_answer_id=answer.id,
    )
    db.add(probe)
    db.commit()
    db.refresh(probe)
    return probe


def is_interview_complete(db: Session, session_id: int) -> bool:
    questions = db.exec(
        select(Question).where(Question.session_id == session_id)
    ).all()
    if not questions:
        return False
    return all(q.answered for q in questions)
