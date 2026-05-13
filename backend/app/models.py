from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime
from enum import Enum
import json


class SessionStatus(str, Enum):
    intake = "intake"
    in_progress = "in_progress"
    finished = "finished"
    evaluated = "evaluated"


class QuestionDimension(str, Enum):
    tech = "tech"
    culture = "culture"


class QuestionKind(str, Enum):
    base = "base"
    probe = "probe"


class InterviewSession(SQLModel, table=True):
    __tablename__ = "interview_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    candidate_name: str
    cv_text: Optional[str] = None
    tech_text: str
    culture_text: str
    status: SessionStatus = SessionStatus.intake
    created_at: datetime = Field(default_factory=datetime.utcnow)

    questions: list["Question"] = Relationship(back_populates="session")
    evaluation: Optional["Evaluation"] = Relationship(back_populates="session")


class Question(SQLModel, table=True):
    __tablename__ = "questions"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="interview_sessions.id")
    order: int
    dimension: QuestionDimension
    kind: QuestionKind = QuestionKind.base
    text: str
    audio_url: Optional[str] = None
    intent: Optional[str] = None
    expected_evidence: Optional[str] = None
    derived_from_answer_id: Optional[int] = Field(default=None, foreign_key="answers.id")
    answered: bool = False

    session: Optional[InterviewSession] = Relationship(back_populates="questions")
    answer: Optional["Answer"] = Relationship(
        back_populates="question",
        sa_relationship_kwargs={"foreign_keys": "[Answer.question_id]"},
    )


class Answer(SQLModel, table=True):
    __tablename__ = "answers"

    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id")
    audio_path: Optional[str] = None
    transcript: Optional[str] = None
    word_timestamps_json: Optional[str] = None  # JSON string
    acoustic_features_json: Optional[str] = None  # JSON string
    linguistic_analysis_json: Optional[str] = None  # JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)

    question: Optional[Question] = Relationship(
        back_populates="answer",
        sa_relationship_kwargs={"foreign_keys": "[Answer.question_id]"},
    )

    def get_acoustic_features(self) -> dict:
        if self.acoustic_features_json:
            return json.loads(self.acoustic_features_json)
        return {}

    def get_linguistic_analysis(self) -> dict:
        if self.linguistic_analysis_json:
            return json.loads(self.linguistic_analysis_json)
        return {}


class Evaluation(SQLModel, table=True):
    __tablename__ = "evaluations"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="interview_sessions.id")
    tech_score: float = 0.0
    culture_score: float = 0.0
    naturalness_factor: float = 1.0
    final_tech_fit: float = 0.0
    final_culture_fit: float = 0.0
    evidence_json: Optional[str] = None  # JSON list
    llm_reasoning_md: Optional[str] = None
    acoustic_summary_json: Optional[str] = None
    linguistic_summary_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    session: Optional[InterviewSession] = Relationship(back_populates="evaluation")

    def get_evidence(self) -> list:
        if self.evidence_json:
            return json.loads(self.evidence_json)
        return []
