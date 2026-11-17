import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from rocketchat_ai import assistant, config

pytestmark = pytest.mark.unit


@pytest.fixture
def fake_ollama(monkeypatch):
    seen = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            seen["path"] = self.path
            seen["body"] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            payload = json.dumps({"message": {"content": "  Respuesta de prueba  "}}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setattr(config, "OLLAMA_URL", f"http://127.0.0.1:{server.server_port}")
    yield seen
    server.shutdown()


def test_answer_sends_the_context_to_ollama_and_trims_the_reply(fake_ollama):
    reply = assistant.answer("¿Qué es tcount?", ["- tcount es el número de respuestas"])

    assert reply == "Respuesta de prueba"
    assert fake_ollama["path"] == "/api/chat"
    body = fake_ollama["body"]
    assert body["stream"] is False and body["options"] == {"temperature": 0}
    assert body["model"] == config.ASSISTANT_MODEL
    assert "tcount es el número de respuestas" in body["messages"][1]["content"]
    assert "SOLO la información del contexto" in body["messages"][0]["content"]


def test_ask_retrieves_the_context_of_the_feature(fake_ollama):
    reply, context = assistant.ask("threads", "¿Qué guarda el mensaje padre, tcount?")

    assert reply == "Respuesta de prueba"
    assert any("tcount" in chunk for chunk in context)


def test_answer_marks_a_missing_context(fake_ollama):
    assistant.answer("¿Algo sin contexto?", [])

    assert "(sin contexto)" in fake_ollama["body"]["messages"][1]["content"]
