from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
import os
import json
import uuid
import tempfile
from pathlib import Path

from app.db import get_session
from app.models import InterviewSession, Question, Answer, SessionStatus
from app.services import stt_service, naturalness as nat_service, llm_service, interview_engine, storage_service

router = APIRouter()


class QuestionOut(BaseModel):
    id: int
    order: int
    dimension: str
    kind: str
    text: str
    audio_url: str
    is_last: bool = False


class AnswerOut(BaseModel):
    answer_id: int
    question_id: int
    transcript: str


@router.get("/{session_id}/next-question")
def next_question(session_id: int, db: Session = Depends(get_session)):
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    if session.status == SessionStatus.evaluated:
        return {"finished": True}

    question = interview_engine.get_next_question(db, session_id)

    if question is None:
        # Mark session finished if all questions answered
        if interview_engine.is_interview_complete(db, session_id):
            session.status = SessionStatus.finished
            db.add(session)
            db.commit()
        return {"finished": True}

    # Peek: is this likely the last?
    all_questions = db.exec(
        select(Question).where(Question.session_id == session_id)
    ).all()
    unanswered_after = [q for q in all_questions if not q.answered and q.id != question.id]
    is_last = len(unanswered_after) == 0

    return QuestionOut(
        id=question.id,
        order=question.order,
        dimension=question.dimension.value,
        kind=question.kind.value,
        text=question.text,
        audio_url=question.audio_url or "",
        is_last=is_last,
    )


@router.post("/{session_id}/answer")
async def submit_answer(
    session_id: int,
    question_id: int = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_session),
):
    session = db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    question = db.get(Question, question_id)
    if not question or question.session_id != session_id:
        raise HTTPException(404, "Question not found")

    # Save audio to temp file first (needed for STT + acoustic analysis)
    filename = f"{uuid.uuid4()}.webm"
    tmp_path = Path(tempfile.gettempdir()) / filename

    content = await audio.read()
    tmp_path.write_bytes(content)

    # Upload to storage (local or R2)
    audio_url = storage_service.upload_audio(str(tmp_path), filename)

    # STT
    try:
        stt_result = stt_service.transcribe(str(tmp_path))
    except Exception as e:
        stt_result = {"text": "[transcription failed]", "words": [], "duration": None}

    transcript = stt_result["text"]
    words = stt_result["words"]

    # Acoustic features
    try:
        acoustic = nat_service.extract_acoustic_features(str(tmp_path), words)
    except Exception:
        acoustic = {"acoustic_score": 0.5}

    # Linguistic analysis (run async-style but sync for simplicity)
    try:
        linguistic = llm_service.evaluate_answer_linguistic(
            cv_text=session.cv_text or "",
            tech_text=session.tech_text,
            culture_text=session.culture_text,
            question_text=question.text,
            dimension=question.dimension.value,
            answer_transcript=transcript,
        )
    except Exception:
        linguistic = {"specificity": 0.5, "consistency": 0.5, "cliche_flags": [], "concrete_signals": [], "inconsistencies": []}

    # Cleanup temp file
    try:
        tmp_path.unlink()
    except OSError:
        pass

    # Persist answer
    answer = Answer(
        question_id=question_id,
        audio_path=audio_url,
        transcript=transcript,
        word_timestamps_json=json.dumps(words, ensure_ascii=False),
        acoustic_features_json=json.dumps(acoustic, ensure_ascii=False),
        linguistic_analysis_json=json.dumps(linguistic, ensure_ascii=False),
    )
    db.add(answer)

    question.answered = True
    db.add(question)
    db.commit()
    db.refresh(answer)

    return AnswerOut(
        answer_id=answer.id,
        question_id=question_id,
        transcript=transcript,
    )
