# E2E con Stagehand y Ollama local

Pruebas E2E guiadas por IA para cinco funcionalidades de Rocket.Chat. [Stagehand](https://docs.stagehand.dev) maneja el
navegador con instrucciones en lenguaje natural (`act`, `extract`) y el modelo corre en tu máquina con Ollama.
Necesita Node 24.15 y Rocket.Chat corriendo en `BASE_URL`.

`src/ollama.ts` conecta Stagehand con Ollama: la v4 no trae un proveedor `ollama/`, pero acepta un modelo propio
(`ClientLLM`). Las peticiones estructuradas se limitan con el esquema JSON de Ollama (`format`).

El modelo **maneja** la interfaz; el **veredicto** de cada prueba lo dan la API y el DOM. Cuando el modelo opina
(`h.asks`), solo se muestra o se usa como pista.

| Feature | Archivo |
| --- | --- |
| threads | `tests/01_threads.e2e.ts` |
| rbac | `tests/02_rbac.e2e.ts` |
| dm | `tests/03_direct_messages.e2e.ts` |
| retention | `tests/04_data_retention.e2e.ts` |
| webhooks | `tests/05_webhooks.e2e.ts` |

```
npm ci
ollama pull qwen2.5:7b-instruct
npm run ollama:check
npm test                      # todo
npm run test:threads          # una funcionalidad: rbac, dm, retention, webhooks
npm run test:unit             # el adaptador, sin Ollama ni Rocket.Chat
```

Variables: `BASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASS`, `OLLAMA_URL` (`http://localhost:11434`), `OLLAMA_MODEL`
(`qwen2.5:7b-instruct`), `OLLAMA_NUM_CTX` (16384), `HEADED=1`, `CHROME_PATH`, `TEST_TIMEOUT_MS`.
Con un modelo local cada `act` tarda segundos: los tiempos límite son amplios a propósito.
Reportes JUnit en `reports/stagehand-<feature>.xml`.
