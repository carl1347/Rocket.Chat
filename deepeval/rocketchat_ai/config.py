import os

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
# El modelo que responde (el sistema bajo prueba) y el que juzga pueden ser distintos.
ASSISTANT_MODEL = os.environ.get("ASSISTANT_MODEL", "qwen2.5:7b-instruct")
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", ASSISTANT_MODEL)
THRESHOLD = float(os.environ.get("DEEPEVAL_THRESHOLD", "0.6"))
REQUEST_TIMEOUT_SECONDS = float(os.environ.get("OLLAMA_TIMEOUT", "300"))
TOP_K = int(os.environ.get("RETRIEVAL_TOP_K", "3"))
