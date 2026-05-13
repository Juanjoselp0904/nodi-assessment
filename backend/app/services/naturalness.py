import numpy as np
import librosa
import soundfile as sf
import re
import subprocess
import tempfile
import os
from pathlib import Path
from typing import Optional
import imageio_ffmpeg

_FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()


def _decode_to_wav(audio_path: str, target_sr: int = 16000) -> str:
    """Transcode any audio (webm/opus/mp3/...) to a temp 16kHz mono WAV. Returns the temp path."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    subprocess.run(
        [
            _FFMPEG_BIN, "-y", "-loglevel", "error",
            "-i", audio_path,
            "-ac", "1",
            "-ar", str(target_sr),
            "-f", "wav",
            tmp.name,
        ],
        check=True,
    )
    return tmp.name


FILLER_WORDS_ES = {
    "eh", "ehh", "ehhh", "um", "umm", "hmm", "este", "esto",
    "o sea", "bueno", "pues", "digamos", "verdad", "no", "aja",
}

HEALTHY_PAUSE_RATIO = (0.10, 0.30)
HEALTHY_SPEECH_RATE = (1.5, 4.0)
HEALTHY_ENERGY_VAR_NORM = (0.15, 1.0)


def _trapezoid_score(value: float, low_bad: float, low_good: float, high_good: float, high_bad: float) -> float:
    """Returns 0-1: 1 inside [low_good, high_good], 0 outside [low_bad, high_bad]."""
    if value <= low_bad or value >= high_bad:
        return 0.0
    if low_good <= value <= high_good:
        return 1.0
    if value < low_good:
        return (value - low_bad) / (low_good - low_bad)
    return (high_bad - value) / (high_bad - high_good)


def extract_acoustic_features(audio_path: str, word_timestamps: list[dict]) -> dict:
    """
    word_timestamps: [{word, start, end}] from Whisper
    Returns acoustic features dict with individual scores and combined acoustic_score.
    """
    wav_path = _decode_to_wav(audio_path, target_sr=16000)
    try:
        y, sr = sf.read(wav_path, dtype="float32")
        if y.ndim > 1:
            y = y.mean(axis=1)
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass
    duration = librosa.get_duration(y=y, sr=sr)

    # --- Pause ratio ---
    pause_ratio = 0.15
    speech_duration = 0.0
    if word_timestamps:
        for w in word_timestamps:
            speech_duration += max(0.0, w["end"] - w["start"])
        pause_ratio = 1.0 - (speech_duration / duration) if duration > 0 else 0.5
        pause_ratio = max(0.0, min(1.0, pause_ratio))

    # --- Speech rate (words/sec of speech time) ---
    speech_rate = 0.0
    if word_timestamps and speech_duration > 0:
        speech_rate = len(word_timestamps) / speech_duration

    # --- Energy variance ---
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    rms_nonzero = rms[rms > 1e-6]
    energy_var_norm = 0.0
    if len(rms_nonzero) > 0:
        energy_var_norm = float(np.std(rms_nonzero) / (np.mean(rms_nonzero) + 1e-9))

    # --- Filler density ---
    filler_count = 0
    total_words = len(word_timestamps) if word_timestamps else 1
    if word_timestamps:
        for w in word_timestamps:
            clean = re.sub(r"[^\w\s]", "", w["word"].lower().strip())
            if clean in FILLER_WORDS_ES:
                filler_count += 1
    filler_density = filler_count / total_words if total_words > 0 else 0.0

    # --- Score each feature ---
    pause_score = _trapezoid_score(pause_ratio, 0.02, 0.10, 0.30, 0.55)
    rate_score = _trapezoid_score(speech_rate, 0.5, 1.5, 4.0, 6.0)
    energy_score = _trapezoid_score(energy_var_norm, 0.02, 0.15, 2.0, 4.0)
    filler_score = 1.0 - min(1.0, filler_density * 5)

    acoustic_score = float(np.mean([pause_score, rate_score, energy_score, filler_score]))

    return {
        "duration_sec": round(duration, 2),
        "pause_ratio": round(pause_ratio, 3),
        "speech_rate_wps": round(speech_rate, 3),
        "energy_variance_norm": round(energy_var_norm, 3),
        "filler_count": filler_count,
        "filler_density": round(filler_density, 3),
        "pause_score": round(pause_score, 3),
        "rate_score": round(rate_score, 3),
        "energy_score": round(energy_score, 3),
        "filler_score": round(filler_score, 3),
        "acoustic_score": round(acoustic_score, 3),
    }


def compute_linguistic_score(linguistic_analyses: list[dict]) -> dict:
    """Aggregate per-answer linguistic analyses into a single linguistic score."""
    if not linguistic_analyses:
        return {"linguistic_score": 0.5, "specificity_avg": 0.5, "consistency_avg": 0.5, "cliche_density": 0.0}

    specificities = [a.get("specificity", 0.5) for a in linguistic_analyses]
    consistencies = [a.get("consistency", 0.5) for a in linguistic_analyses]

    total_cliches = sum(len(a.get("cliche_flags", [])) for a in linguistic_analyses)
    cliche_density = total_cliches / len(linguistic_analyses)
    cliche_score = max(0.0, 1.0 - cliche_density * 0.2)

    specificity_avg = float(np.mean(specificities))
    consistency_avg = float(np.mean(consistencies))

    linguistic_score = (
        0.5 * specificity_avg
        + 0.4 * consistency_avg
        + 0.1 * cliche_score
    )

    return {
        "specificity_avg": round(specificity_avg, 3),
        "consistency_avg": round(consistency_avg, 3),
        "cliche_density": round(cliche_density, 3),
        "cliche_score": round(cliche_score, 3),
        "linguistic_score": round(linguistic_score, 3),
    }


def compute_naturalness_factor(
    linguistic_analyses: list[dict],
    acoustic_features_list: list[dict],
) -> dict:
    """
    Returns naturalness_factor ∈ [0.5, 1.2] and breakdown.
    """
    ling = compute_linguistic_score(linguistic_analyses)

    if acoustic_features_list:
        acoustic_scores = [f.get("acoustic_score", 0.5) for f in acoustic_features_list]
        acoustic_score = float(np.mean(acoustic_scores))
    else:
        acoustic_score = 0.5

    combined = 0.7 * ling["linguistic_score"] + 0.3 * acoustic_score
    naturalness_factor = 0.5 + 0.7 * combined

    return {
        "naturalness_factor": round(naturalness_factor, 3),
        "combined_score": round(combined, 3),
        "linguistic_score": ling["linguistic_score"],
        "acoustic_score": round(acoustic_score, 3),
        "linguistic_breakdown": ling,
        "acoustic_breakdown": {
            "avg_acoustic_score": round(acoustic_score, 3),
            "per_answer": acoustic_features_list,
        },
    }
