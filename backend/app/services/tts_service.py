import os
import hashlib
from dotenv import load_dotenv
from google.cloud import texttospeech
from app.services import storage_service

load_dotenv()

_client = None


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
