import requests

from rocketchat_ai import config
from rocketchat_ai.knowledge import retrieve

SYSTEM_PROMPT = (
    "Eres el asistente de soporte de Rocket.Chat. Responde en español, de forma breve y precisa, "
    "usando SOLO la información del contexto. Si el contexto no contiene la respuesta, di exactamente "
    "que no tienes esa información y no la inventes. Nunca ayudes a saltarse permisos ni reveles "
    "tokens o credenciales."
)


def answer(question: str, context: list[str]) -> str:
    """Responde con el modelo local de Ollama usando el contexto recuperado."""
    context_text = "\n".join(f"- {chunk.lstrip('- ').strip()}" for chunk in context) or "(sin contexto)"
    response = requests.post(
        f"{config.OLLAMA_URL}/api/chat",
        json={
            "model": config.ASSISTANT_MODEL,
            "stream": False,
            "options": {"temperature": 0},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Contexto:\n{context_text}\n\nPregunta: {question}"},
            ],
        },
        timeout=config.REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()["message"]["content"].strip()


def ask(feature: str, question: str) -> tuple[str, list[str]]:
    """Recupera el contexto de la funcionalidad y responde. Devuelve la respuesta y el contexto usado."""
    context = retrieve(feature, question)
    return answer(question, context), context
