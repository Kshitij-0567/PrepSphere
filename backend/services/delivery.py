"""
Delivery feedback for spoken answers: speaking pace, filler words, long pauses and eye contact.

The browser measures what only it can see (voiced time, silences, and eye contact from on-device
face tracking); this module sanitises those numbers and adds what the transcript shows. Delivery
is reported separately and never changes the content score.
"""
import math
import re
from typing import Any, Dict, Iterable, List, Optional

PACE_TARGET = (120, 160)          # words per minute
LONG_PAUSE_SECONDS = 3.0
MAX_ANSWER_SECONDS = 20 * 60      # a whole coding step with think-aloud can run long
MIN_PACE_SECONDS = 10             # too little speech to judge pace below this
MAX_PLAUSIBLE_PACE = 300          # words per minute; fast speakers reach about 220

# Keep in sync with FILLER_RE in frontend/src/pages/interview/delivery.js, which highlights them.
FILLER_PATTERNS = {
    "um": re.compile(r"\bu+m+\b", re.IGNORECASE),
    "uh": re.compile(r"\b(?:u+h+|e+r+m*)\b", re.IGNORECASE),
    "basically": re.compile(r"\bbasically\b", re.IGNORECASE),
    "literally": re.compile(r"\bliterally\b", re.IGNORECASE),
    "you know": re.compile(r"\byou know\b", re.IGNORECASE),
    "I mean": re.compile(r"\bi mean\b", re.IGNORECASE),
    # "like" only counts as a filler when set off by a comma ("so, like, we..."), not in "I like Go".
    "like": re.compile(r",\s*like\b|\blike\s*,", re.IGNORECASE),
}


def count_fillers(text: str) -> Dict[str, int]:
    counts = {word: len(pattern.findall(text or "")) for word, pattern in FILLER_PATTERNS.items()}
    return {word: n for word, n in counts.items() if n}


def _number(value: Any, low: float, high: float) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return max(low, min(high, number))


def _pauses(value: Any, limit: float) -> List[List[float]]:
    """[[start, length], ...] for silences of at least LONG_PAUSE_SECONDS, sorted and capped."""
    pauses: List[List[float]] = []
    if not isinstance(value, list):
        return pauses
    for item in value[:200]:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            continue
        start, length = _number(item[0], 0, limit), _number(item[1], 0, limit)
        if start is None or length is None or length < LONG_PAUSE_SECONDS:
            continue
        pauses.append([round(start, 1), round(length, 1)])
    return sorted(pauses)[:60]


def build_delivery(client: Dict[str, Any], transcript: str, spoken: bool) -> Dict[str, Any]:
    """Delivery record for one answer, from the browser's measurements and the transcript."""
    client = client if isinstance(client, dict) else {}
    duration = _number(client.get("duration"), 0, MAX_ANSWER_SECONDS) or 0.0
    speaking = _number(client.get("speaking"), 0, duration or MAX_ANSWER_SECONDS)
    words = len(re.findall(r"[A-Za-z0-9']+", transcript or ""))
    basis = speaking if speaking and speaking >= 5 else duration
    pace = round(words / (basis / 60)) if spoken and basis >= MIN_PACE_SECONDS and words >= 15 else None
    if pace is not None and pace > MAX_PLAUSIBLE_PACE:
        pace = None  # the transcript and the measured speaking time don't match; don't report nonsense
    fillers = count_fillers(transcript) if spoken else {}
    pauses = _pauses(client.get("pauses"), duration or MAX_ANSWER_SECONDS) if spoken else []
    return {
        "duration": round(duration, 1),
        "speaking": round(speaking, 1) if speaking is not None else None,
        "words": words,
        "pace": pace,
        "fillers": fillers,
        "filler_total": sum(fillers.values()),
        "pauses": pauses,
        "long_pauses": len(pauses),
        "longest_pause": max((p[1] for p in pauses), default=None),
        "eye_contact": _ratio(client.get("eye_contact")),
        "face_in_frame": _ratio(client.get("face_in_frame")),
        "step_offset": _number(client.get("step_offset"), 0, 6 * 3600),
        "question_offset": _number(client.get("question_offset"), 0, 6 * 3600),
    }


def _ratio(value: Any) -> Optional[float]:
    number = _number(value, 0, 1)
    return round(number, 3) if number is not None else None


def summarize(records: Iterable[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Interview-level delivery from each answer's record (records with no audio are skipped)."""
    records = [r for r in records if r and (r.get("speaking") or r.get("duration"))]
    if not records:
        return None
    talk_seconds = sum((r.get("speaking") or r.get("duration") or 0) for r in records)
    paced = [r for r in records if r.get("pace")]
    paced_minutes = sum((r.get("speaking") or r.get("duration") or 0) for r in paced) / 60
    paced_words = sum(r.get("words") or 0 for r in paced)
    fillers: Dict[str, int] = {}
    for r in records:
        for word, n in (r.get("fillers") or {}).items():
            fillers[word] = fillers.get(word, 0) + int(n)
    filler_total = sum(fillers.values())
    eye = [(r["eye_contact"], r.get("duration") or 1) for r in records if r.get("eye_contact") is not None]
    frame = [(r["face_in_frame"], r.get("duration") or 1) for r in records if r.get("face_in_frame") is not None]
    longest = max((r.get("longest_pause") or 0 for r in records), default=0)
    minutes = talk_seconds / 60
    return {
        "pace": round(paced_words / paced_minutes) if paced_minutes > 0 and paced_words >= 30 else None,
        "pace_target": list(PACE_TARGET),
        "fillers": dict(sorted(fillers.items(), key=lambda kv: -kv[1])),
        "filler_total": filler_total,
        "fillers_per_minute": round(filler_total / minutes, 1) if minutes >= 1 else None,
        "eye_contact": _weighted(eye),
        "face_in_frame": _weighted(frame),
        "long_pauses": sum(r.get("long_pauses") or 0 for r in records),
        "longest_pause": longest or None,
        "talk_seconds": round(talk_seconds),
    }


def _weighted(pairs: List[tuple]) -> Optional[float]:
    total = sum(w for _, w in pairs)
    return round(sum(v * w for v, w in pairs) / total, 3) if total else None


def delivery_tips(summary: Optional[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Study-plan items for delivery habits worth working on."""
    if not summary:
        return []
    tips: List[Dict[str, str]] = []
    top = next(iter(summary["fillers"].items()), None)
    if top and (summary.get("fillers_per_minute") or 0) >= 2:
        tips.append({
            "topic": "Fewer filler words",
            "priority": "Medium",
            "reason": f'You said "{top[0]}" {top[1]} times. A short silent pause sounds more confident than a filler.',
        })
    pace = summary.get("pace")
    if pace and pace > PACE_TARGET[1] + 10:
        tips.append({"topic": "Slow down when you explain", "priority": "Low",
                     "reason": f"You spoke at about {pace} words a minute. Aim for 120 to 160 so interviewers can follow."})
    elif pace and pace < PACE_TARGET[0] - 15:
        tips.append({"topic": "Keep your answers moving", "priority": "Low",
                     "reason": f"You spoke at about {pace} words a minute. Planning the structure first helps you speak more fluently."})
    eye = summary.get("eye_contact")
    if eye is not None and eye < 0.5:
        tips.append({"topic": "Look at the camera more", "priority": "Low",
                     "reason": f"You looked at the camera about {round(eye * 100)}% of the time. Place your notes near the camera."})
    return tips
