from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
import json

from app.db import get_session
from app.models import (
    InterviewSession, Question, Answer, Evaluation, SessionStatus
)
from app.services import llm_service, naturalness as nat_service

router = APIRouter()


class SessionListItem(BaseModel):
    id: int
    candidate_name: str
    status: str
    tech_fit: Optional[float] = None
    culture_fit: Optional[float] = None
    naturalness_factor: Optional[float] = None
    created_at: str


class FinalizeResponse(BaseModel):
    tech_score: float
    culture_score: float
    naturalness_factor: float
    final_tech_fit: float
    final_culture_fit: float


@router.get("/sessions", response_model=list[SessionListItem])
def list_sessions(db: Session = Depends(get_session)):
    sessions = db.exec(select(InterviewSession).order_by(InterviewSession.created_at.desc())).all()
    result = []
    for s in sessions:
        ev = s.evaluation
        result.append(SessionListItem(
            id=s.id,
            candidate_name=s.candidate_name,
            status=s.status.value,
            tech_fit=ev.final_tech_fit if ev else None,
            culture_fit=ev.final_culture_fit if ev else None,
            naturalness_factor=ev.naturalness_factor if ev else None,
            created_at=s.created_at.isoformat(),
        ))
    return result


@router.post("/sessions/{session_id}/finalize", response_model=FinalizeResponse)
def finalize_session(session_id: int, db: Session = Depends(get_session)):
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    if session.evaluation:
        ev = session.evaluation
        return FinalizeResponse(
            tech_score=ev.tech_score,
            culture_score=ev.culture_score,
            naturalness_factor=ev.naturalness_factor,
            final_tech_fit=ev.final_tech_fit,
            final_culture_fit=ev.final_culture_fit,
        )

    questions = db.exec(
        select(Question)
        .where(Question.session_id == session_id)
        .order_by(Question.order)
    ).all()

    qa_pairs = []
    linguistic_analyses = []
    acoustic_features_list = []

    for q in questions:
        answer = db.exec(select(Answer).where(Answer.question_id == q.id)).first()
        if answer and answer.transcript:
            qa_pairs.append({
                "dimension": q.dimension.value,
                "question": q.text,
                "transcript": answer.transcript,
            })
            if answer.linguistic_analysis_json:
                linguistic_analyses.append(json.loads(answer.linguistic_analysis_json))
            if answer.acoustic_features_json:
                acoustic_features_list.append(json.loads(answer.acoustic_features_json))

    if not qa_pairs:
        raise HTTPException(400, "No answered questions found")

    # Final LLM evaluation
    try:
        eval_result = llm_service.final_evaluation(
            candidate_name=session.candidate_name,
            cv_text=session.cv_text or "",
            tech_text=session.tech_text,
            culture_text=session.culture_text,
            qa_pairs=qa_pairs,
            linguistic_analyses=linguistic_analyses,
        )
    except Exception as e:
        raise HTTPException(500, f"LLM evaluation failed: {str(e)}")

    # Naturalness
    nat = nat_service.compute_naturalness_factor(linguistic_analyses, acoustic_features_list)
    naturalness_factor = nat["naturalness_factor"]

    tech_score = float(eval_result.get("tech_score", 0.5))
    culture_score = float(eval_result.get("culture_score", 0.5))

    evaluation = Evaluation(
        session_id=session_id,
        tech_score=tech_score,
        culture_score=culture_score,
        naturalness_factor=naturalness_factor,
        final_tech_fit=round(tech_score * naturalness_factor, 3),
        final_culture_fit=round(culture_score * naturalness_factor, 3),
        evidence_json=json.dumps(eval_result.get("evidence", []), ensure_ascii=False),
        llm_reasoning_md=eval_result.get("reasoning_md", ""),
        acoustic_summary_json=json.dumps(nat["acoustic_breakdown"], ensure_ascii=False),
        linguistic_summary_json=json.dumps(nat["linguistic_breakdown"], ensure_ascii=False),
    )
    db.add(evaluation)

    session.status = SessionStatus.evaluated
    db.add(session)
    db.commit()
    db.refresh(evaluation)

    return FinalizeResponse(
        tech_score=evaluation.tech_score,
        culture_score=evaluation.culture_score,
        naturalness_factor=evaluation.naturalness_factor,
        final_tech_fit=evaluation.final_tech_fit,
        final_culture_fit=evaluation.final_culture_fit,
    )


@router.get("/sessions/{session_id}/report")
def get_report(session_id: int, db: Session = Depends(get_session)):
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    questions = db.exec(
        select(Question)
        .where(Question.session_id == session_id)
        .order_by(Question.order)
    ).all()

    qa_detail = []
    for q in questions:
        answer = db.exec(select(Answer).where(Answer.question_id == q.id)).first()
        qa_detail.append({
            "question_id": q.id,
            "question_text": q.text,
            "dimension": q.dimension.value,
            "kind": q.kind.value,
            "answer_id": answer.id if answer else None,
            "transcript": answer.transcript if answer else None,
            "audio_path": answer.audio_path if answer else None,
            "acoustic_features": json.loads(answer.acoustic_features_json) if answer and answer.acoustic_features_json else None,
            "linguistic_analysis": json.loads(answer.linguistic_analysis_json) if answer and answer.linguistic_analysis_json else None,
        })

    ev = session.evaluation
    evaluation_data = None
    if ev:
        evaluation_data = {
            "tech_score": ev.tech_score,
            "culture_score": ev.culture_score,
            "naturalness_factor": ev.naturalness_factor,
            "final_tech_fit": ev.final_tech_fit,
            "final_culture_fit": ev.final_culture_fit,
            "evidence": json.loads(ev.evidence_json) if ev.evidence_json else [],
            "reasoning_md": ev.llm_reasoning_md,
            "acoustic_summary": json.loads(ev.acoustic_summary_json) if ev.acoustic_summary_json else {},
            "linguistic_summary": json.loads(ev.linguistic_summary_json) if ev.linguistic_summary_json else {},
        }

    return {
        "session": {
            "id": session.id,
            "candidate_name": session.candidate_name,
            "status": session.status.value,
            "created_at": session.created_at.isoformat(),
            "cv_text": session.cv_text,
            "tech_text": session.tech_text,
            "culture_text": session.culture_text,
        },
        "qa_detail": qa_detail,
        "evaluation": evaluation_data,
    }
