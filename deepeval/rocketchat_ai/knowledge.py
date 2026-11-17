import re
from pathlib import Path

from rocketchat_ai.config import TOP_K

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"
_WORD = re.compile(r"[\wáéíóúñü]+", re.IGNORECASE)
_STOPWORDS = {"el", "la", "los", "las", "de", "del", "un", "una", "y", "o", "en", "que", "se", "es", "por", "con", "para", "a", "al", "lo", "su", "si", "no"}


def chunks(feature: str) -> list[str]:
    """Un fragmento por viñeta o párrafo del documento de la funcionalidad."""
    text = (KNOWLEDGE_DIR / f"{feature}.md").read_text(encoding="utf-8")
    parts = [part.strip() for part in re.split(r"\n\s*\n|\n(?=- )", text)]
    return [part for part in parts if part and not part.startswith("#")]


def _terms(text: str) -> set[str]:
    return {word.lower() for word in _WORD.findall(text) if word.lower() not in _STOPWORDS and len(word) > 2}


def retrieve(feature: str, question: str, top_k: int = TOP_K) -> list[str]:
    """Los fragmentos que más palabras comparten con la pregunta, del más al menos parecido."""
    wanted = _terms(question)
    scored = [(len(wanted & _terms(chunk)), chunk) for chunk in chunks(feature)]
    ranked = sorted((item for item in scored if item[0] > 0), key=lambda item: -item[0])
    return [chunk for _, chunk in ranked[:top_k]]
