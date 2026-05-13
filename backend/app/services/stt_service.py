import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def transcribe(audio_path: str) -> dict:
    """Returns {text, words: [{word, start, end}]}"""
    client = _get_client()
    with open(audio_path, "rb") as f:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language="es",
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

    words = []
    if hasattr(response, "words") and response.words:
        words = [
            {"word": w.word, "start": w.start, "end": w.end}
            for w in response.words
        ]

    return {
        "text": response.text,
        "words": words,
        "duration": response.duration if hasattr(response, "duration") else None,
    }
