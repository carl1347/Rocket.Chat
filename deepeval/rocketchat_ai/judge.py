from functools import lru_cache

from deepeval.models import OllamaModel

from rocketchat_ai import config


@lru_cache(maxsize=1)
def judge() -> OllamaModel:
    """El juez de DeepEval: un modelo de Ollama en la máquina local, sin enviar datos fuera."""
    return OllamaModel(model=config.JUDGE_MODEL, base_url=config.OLLAMA_URL, temperature=0)
