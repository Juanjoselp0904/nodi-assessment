import os
import hashlib
from pathlib import Path
from dotenv import load_dotenv
from google.cloud import texttospeech

load_dotenv()

_client = None
STORAGE_PATH = os.getenv("STORAGE_PATH", "./storage")
CACHE_DIR = Path(STORAGE_PATH) / "tts_cache"


def _get_client() -> texttospeech.TextToSpeechClient:
    global _client
    if _client is None:
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path:
            _client = texttospeech.TextToSpeechClient.from_service_account_json(creds_path)
        else:
            _client = texttospeech.TextToSpeechClient()
    return _client


def synthesize(text: str, lang: str = "es-US") -> str:
    """Returns the URL path to the cached mp3 file."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    cache_key = hashlib.md5(f"{lang}:{text}".encode()).hexdigest()
    cached_path = CACHE_DIR / f"{cache_key}.mp3"

    if cached_path.exists():
        return f"/storage/tts_cache/{cache_key}.mp3"

    client = _get_client()

    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code=lang,
        ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=0.95,
    )

    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )

    cached_path.write_bytes(response.audio_content)
    return f"/storage/tts_cache/{cache_key}.mp3"
