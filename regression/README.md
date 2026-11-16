# Regression suites: API, security and performance

Five Rocket.Chat features, three kinds of check each. Needs Node 24.15 (it runs the `.ts` files directly)
and a Rocket.Chat server reachable at `BASE_URL`.

| Feature | API | Security | Performance |
| --- | --- | --- | --- |
| threads | `api/01_threads.api.test.ts` | `security/01_threads.security.test.ts` | `performance/01_threads.perf.ts` |
| rbac | `api/02_rbac.api.test.ts` | `security/02_rbac.security.test.ts` | `performance/02_rbac.perf.ts` |
| dm | `api/03_direct_messages.api.test.ts` | `security/03_direct_messages.security.test.ts` | `performance/03_direct_messages.perf.ts` |
| retention | `api/04_data_retention.api.test.ts` | `security/04_data_retention.security.test.ts` | `performance/04_data_retention.perf.ts` |
| webhooks | `api/05_webhooks.api.test.ts` | `security/05_webhooks.security.test.ts` | `performance/05_webhooks.perf.ts` |

```
npm ci
npm test                      # everything
npm run test:api              # or test:security, test:perf
npm run test:threads          # one feature, all three kinds (rbac, dm, retention, webhooks)
npm run test:security:rbac    # one kind of one feature
```

Settings: `BASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASS`; performance also reads `PERF_DURATION` (seconds, 10),
`PERF_CONNECTIONS` (10), `PERF_P99_MS` (1500) and `PERF_MIN_RPS` (5).

Each suite creates its own users and rooms and removes them afterwards. It switches the server rate limiter off and
restores it, except the webhook rate-limit test, which needs the server to run without `TEST_MODE`.

Reports: `reports/<type>-<feature>.xml` (JUnit) and `reports/performance/<feature>.json`.
A test marked "currently ..." pins behavior the server has today even though it is probably not the intended one;
change its expectation when the server is fixed.
