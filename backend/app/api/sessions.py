from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel
from typing import Optional

from app.db import get_session
from app.models import InterviewSession, SessionStatus
from app.services import interview_engine

router = APIRouter()


class CreateSessionRequest(BaseModel):
    candidate_name: str
    cv_text: Optional[str] = None
    tech_text: str
    culture_text: str


class SessionResponse(BaseModel):
    id: int
    candidate_name: str
    status: str


@router.post("", response_model=SessionResponse, status_code=201)
def create_session(body: CreateSessionRequest, db: Session = Depends(get_session)):
    session = InterviewSession(
        candidate_name=body.candidate_name,
        cv_text=body.cv_text,
        tech_text=body.tech_text,
        culture_text=body.culture_text,
        status=SessionStatus.intake,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Generate questions synchronously (acceptable for demo)
    interview_engine.initialize_session(db, session)
    db.refresh(session)

    return SessionResponse(
        id=session.id,
        candidate_name=session.candidate_name,
        status=session.status.value,
    )
