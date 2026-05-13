"""
Abstraction over local filesystem vs Cloudflare R2.

If R2_BUCKET_NAME is set in env → use R2 (production).
Otherwise → use local filesystem under STORAGE_PATH (development).
"""
import os
import tempfile
import hashlib
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

_STORAGE_PATH = os.getenv("STORAGE_PATH", "./storage")
_BUCKET = os.getenv("R2_BUCKET_NAME", "")
_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "").rstrip("/")

_s3 = None


def _get_s3():
    global _s3
    if _s3 is None:
        import boto3
        _s3 = boto3.client(
            "s3",
            endpoint_url=os.getenv("R2_ENDPOINT_URL"),
            aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
            region_name="auto",
        )
    return _s3


def _use_r2() -> bool:
    return bool(_BUCKET)


# ── Upload ──────────────────────────────────────────────────────────────────

def upload_audio(local_path: str, filename: str) -> str:
    """Upload candidate audio. Returns public URL."""
    key = f"audio/{filename}"
    if _use_r2():
        _get_s3().upload_file(local_path, _BUCKET, key, ExtraArgs={"ContentType": "audio/webm"})
        return f"{_PUBLIC_URL}/{key}"
    dest = Path(_STORAGE_PATH) / "audio" / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(local_path, dest)
    return f"/storage/audio/{filename}"


def upload_tts(audio_bytes: bytes, cache_key: str) -> str:
    """Upload TTS audio bytes. Returns public URL."""
    filename = f"{cache_key}.mp3"
    key = f"tts_cache/{filename}"
    if _use_r2():
        import io
        _get_s3().upload_fileobj(
            io.BytesIO(audio_bytes), _BUCKET, key,
            ExtraArgs={"ContentType": "audio/mpeg"},
        )
        return f"{_PUBLIC_URL}/{key}"
    dest = Path(_STORAGE_PATH) / "tts_cache" / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(audio_bytes)
    return f"/storage/tts_cache/{filename}"


def tts_exists(cache_key: str) -> bool:
    """Check if TTS file is already cached."""
    if _use_r2():
        try:
            _get_s3().head_object(Bucket=_BUCKET, Key=f"tts_cache/{cache_key}.mp3")
            return True
        except Exception:
            return False
    return (Path(_STORAGE_PATH) / "tts_cache" / f"{cache_key}.mp3").exists()


def tts_cached_url(cache_key: str) -> str:
    if _use_r2():
        return f"{_PUBLIC_URL}/tts_cache/{cache_key}.mp3"
    return f"/storage/tts_cache/{cache_key}.mp3"


# ── Download to temp (for librosa analysis) ─────────────────────────────────

def download_to_temp(url_or_path: str) -> str:
    """
    Given a public URL or local path, return a local temp file path.
    Caller is responsible for deleting the temp file.
    """
    if _use_r2() and url_or_path.startswith("http"):
        key = url_or_path.replace(f"{_PUBLIC_URL}/", "")
        tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
        tmp.close()
        _get_s3().download_file(_BUCKET, key, tmp.name)
        return tmp.name
    # Local path — strip leading /storage prefix if present
    if url_or_path.startswith("/storage/"):
        return str(Path(_STORAGE_PATH) / url_or_path[len("/storage/"):])
    return url_or_path
