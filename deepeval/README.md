# Pruebas de IA con DeepEval y Ollama local

Evalúa un asistente de soporte de Rocket.Chat que responde en español sobre cinco funcionalidades. El asistente
(`rocketchat_ai/assistant.py`) usa un modelo de Ollama con la base de conocimiento de `knowledge/`; **DeepEval**
puntúa sus respuestas con otro modelo de Ollama como juez. Nada sale de tu máquina.

Por caso se miden: relevancia de la respuesta, fidelidad al contexto (`FaithfulnessMetric`) y exactitud frente a la
respuesta esperada (`GEval`). Los casos de tipo `error` (preguntas sin respuesta en el contexto o intentos de saltarse
permisos) miden en su lugar que la respuesta sea honesta y segura.

| Feature | Dataset | Prueba |
| --- | --- | --- |
| threads | `datasets/01_threads.json` | `tests/test_01_threads.py` |
| rbac | `datasets/02_rbac.json` | `tests/test_02_rbac.py` |
| dm | `datasets/03_direct_messages.json` | `tests/test_03_direct_messages.py` |
| retention | `datasets/04_data_retention.json` | `tests/test_04_data_retention.py` |
| webhooks | `datasets/05_webhooks.json` | `tests/test_05_webhooks.py` |

```
python -m venv .venv && source .venv/bin/activate      # en fish: source .venv/bin/activate.fish
pip install -r requirements.txt
ollama pull qwen2.5:7b-instruct
deepeval test run tests/                               # todo
deepeval test run tests/test_01_threads.py             # una funcionalidad
pytest -m unit                                         # sin Ollama: recuperador, datasets y cliente
```

Variables: `OLLAMA_URL` (`http://localhost:11434`), `ASSISTANT_MODEL` y `JUDGE_MODEL` (`qwen2.5:7b-instruct`),
`DEEPEVAL_THRESHOLD` (0.6), `OLLAMA_TIMEOUT`, `RETRIEVAL_TOP_K`.
Un juez de 7B puntúa con ruido: usa un modelo más grande como `JUDGE_MODEL` para resultados más estables.
La base de conocimiento describe el comportamiento actual del servidor, incluidos los casos que probablemente
cambien (token corrupto con 500, fechas invertidas con 200); actualízala junto con las pruebas de regresión.
