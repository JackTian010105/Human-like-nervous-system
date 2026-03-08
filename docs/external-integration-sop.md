# External Integration SOP (Partner Onboarding)

This SOP is for third-party integrators (Mozi role) to connect with the Command Neural System.

## 1) Preconditions

- Base URL: `http://localhost:3001` (replace with your environment URL)
- External token: `x-external-token`
- Idempotency key for command writes: `Idempotency-Key`

## 2) Register Callback Subscription

Endpoint:

```http
POST /api/external/callbacks/register
```

Headers:

- `x-external-token: <token>`
- `content-type: application/json`

Body:

```json
{
  "externalSystemId": "mozi-system",
  "callbackUrl": "https://partner.example/callback",
  "signingSecret": "your-shared-secret"
}
```

Expected result:

- Returns `subscriptionId`
- Starts generating signed delivery records for new events

## 3) Submit External Command

Endpoint:

```http
POST /api/external/commands
```

Headers:

- `x-external-token: <token>`
- `Idempotency-Key: <unique-key-per-logical-command>`
- `content-type: application/json`

Body:

```json
{
  "externalSystemId": "mozi-system",
  "content": "全队待命",
  "targetNode": "captain-A",
  "executionRequirement": "立即执行",
  "feedbackRequirement": "30秒回执"
}
```

Expected result:

- Returns `command.commandId` and `status`
- Returns `replayed=true` when same key is reused within 24h

## 4) Read Events (Order Reconstruction)

Endpoint:

```http
GET /api/external/events?commandId=<commandId>&order=asc
```

Headers:

- `x-external-token: <token>`

Rule:

- Always use `order=asc` for same command when rebuilding state transitions
- Trust `eventSequence` as ordering source for that command

## 5) Verify Callback Signature

Read callback deliveries:

```http
GET /api/external/callbacks/deliveries?commandId=<commandId>
```

Each record includes:

- `signatureHeader = X-Signature-HMAC-SHA256`
- `signatureValue` (hex)
- `payload` (event JSON)

Verification command:

```bash
pnpm verify:callback-signature /tmp/payload.json <signature-hex> <secret>
```

Reference:

- `docs/external-callback-signature.md`

## 6) Retry/Failure Semantics

Delivery record fields:

- `attempts`
- `maxAttempts` (3)
- `status` (`SUCCESS` or `FAILED`)
- `lastError` when failed

Interpretation:

- `SUCCESS`: delivered within retry budget
- `FAILED`: exhausted 3 attempts, must be handled by partner-side reconciliation

## 7) Common Failure Cases

- `401 Invalid external credential`
  - Token mismatch, rotate/verify `x-external-token`
- `400 Idempotency-Key header is required`
  - Missing idempotency key on write endpoint
- Signature mismatch
  - Wrong secret or payload modified before verification

## 8) Minimal Go-Live Checklist

- Callback subscription registered
- Command write path tested with idempotent replay
- Event read path tested with `order=asc`
- Signature verification passed at least once
- Failure path validated (`status=FAILED` record can be detected and escalated)

## 9) One-Command E2E Validation

Run:

```bash
pnpm e2e:external-integration
```

This script validates:

- callback registration (success + fail simulation)
- external command write with idempotency
- ordered event reconstruction (`order=asc`)
- signed callback delivery records
- retry semantics (`FAILED` with `attempts=3`)
- local signature verification helper
