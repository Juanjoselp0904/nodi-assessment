from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os

from app.db import create_db_and_tables
from app.api import sessions, interview, recruiter

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Nodi Interview API", lifespan=lifespan)

# Allow localhost in dev and any Vercel deployment in prod
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
vercel_url = os.getenv("FRONTEND_URL", "")
if vercel_url:
    ALLOWED_ORIGINS.append(vercel_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local storage only when not using R2
if not os.getenv("R2_BUCKET_NAME"):
    storage_path = os.getenv("STORAGE_PATH", "./storage")
    os.makedirs(f"{storage_path}/audio", exist_ok=True)
    os.makedirs(f"{storage_path}/tts_cache", exist_ok=True)
    app.mount("/storage", StaticFiles(directory=storage_path), name="storage")

app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(interview.router, prefix="/api/sessions", tags=["interview"])
app.include_router(recruiter.router, prefix="/api/recruiter", tags=["recruiter"])


@app.get("/health")
def health():
    return {"status": "ok"}
