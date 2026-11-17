import os

# Todo corre en local: no se envían resultados ni métricas de uso a servicios externos.
os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")

import pytest
import requests

from rocketchat_ai import config


@pytest.fixture(scope="session", autouse=True)
def ollama_ready(request):
    """Falla con un mensaje claro si Ollama no responde o falta un modelo; las pruebas unitarias no lo necesitan."""
    if all("unit" in item.keywords for item in request.session.items):
        return
    try:
        tags = requests.get(f"{config.OLLAMA_URL}/api/tags", timeout=5)
        tags.raise_for_status()
    except requests.RequestException as error:
        pytest.exit(f"No hay conexión con Ollama en {config.OLLAMA_URL} ({error}). Inícialo con: ollama serve", returncode=1)
    installed = {model["name"] for model in tags.json().get("models", [])}
    for model in {config.ASSISTANT_MODEL, config.JUDGE_MODEL}:
        if model not in installed and f"{model}:latest" not in installed:
            pytest.exit(f"Falta el modelo {model} en Ollama. Instálalo con: ollama pull {model}", returncode=1)
