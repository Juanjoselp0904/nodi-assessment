import os
import json
import hashlib
import tempfile
from dotenv import load_dotenv
from google.cloud import texttospeech
from google.oauth2 import service_account
from app.services import storage_service

load_dotenv()

_client = None


def _get_client() -> texttospeech.TextToSpeechClient:
    global _client
    if _client is None:
        # Option 1: JSON content passed directly as env var (production/Railway)
        creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
        if creds_json:
            info = json.loads(creds_json)
            creds = service_account.Credentials.from_service_account_info(
                info,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            _client = texttospeech.TextToSpeechClient(credentials=creds)
        else:
            # Option 2: path to JSON file (local dev)
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if creds_path and os.path.exists(creds_path):
                creds = service_account.Credentials.from_service_account_file(
                    creds_path,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
                _client = texttospeech.TextToSpeechClient(credentials=creds)
            else:
                # Option 3: Application Default Credentials
                _client = texttospeech.TextToSpeechClient()
    return _client


def synthesize(text: str, lang: str = "es-US") -> str:
    """Returns public URL to the mp3 file."""
    cache_key = hashlib.md5(f"{lang}:{text}".encode()).hexdigest()

    if storage_service.tts_exists(cache_key):
        return storage_service.tts_cached_url(cache_key)

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

    return storage_service.upload_tts(response.audio_content, cache_key)
