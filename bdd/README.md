# BDD con Cucumber + Screenplay (Serenity/JS)

Escenarios Gherkin (Dado/Cuando/Entonces) para cinco funcionalidades de Rocket.Chat, ejecutados con
Cucumber y el patrón Screenplay de [Serenity/JS](https://serenity-js.org): actores con habilidades
(`CallAnApi`, `BrowseTheWebWithPlaywright`, `HoldRocketChatSession`), tareas, interacciones y preguntas.

| Feature | Archivo |
| --- | --- |
| Hilos de conversación | `features/01_threads.feature` |
| Control de acceso (RBAC) | `features/02_rbac_permissions.feature` |
| Mensajería directa | `features/03_direct_messages.feature` |
| Retención y depuración | `features/04_data_retention.feature` |
| Webhooks e integraciones | `features/05_webhooks_integrations.feature` |

```
src/screenplay/abilities     habilidades de los actores
src/screenplay/interactions  llamadas atómicas a la API
src/screenplay/tasks         tareas de negocio (API y UI)
src/screenplay/questions     preguntas sobre el estado del sistema
src/screenplay/ui            localizadores de la interfaz
features/steps               pasos Cucumber, sin lógica de negocio
```

## Uso

Con Rocket.Chat corriendo en `http://localhost:3000`:

```
npm ci
npx playwright-core install chromium
npm test
npm run test:report
```

Variables: `BASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASS`, `HEADED=1` (ver el navegador), `CHROMIUM_PATH`.

Reportes: `reports/cucumber-report.html` (Cucumber) y `target/site/serenity/index.html` tras `npm run test:report`
(requiere Java 11 o superior).
