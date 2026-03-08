# Staging Go-Live Checklist

Use this checklist before promoting the current build to staging.

## 1) Configuration

- [ ] `DATABASE_URL` points to the staging database
- [ ] `EXTERNAL_API_TOKEN` is set and is not the default token

## 2) Database Access

- [ ] Application DB user has required privileges (`create/insert/update/select`)
- [ ] Service does not run with superuser DB credentials

## 3) DB Connectivity

- [ ] Startup logs include `PostgreSQL persistence enabled`
- [ ] `GET /health` returns success

## 4) Automated Acceptance

- [ ] `pnpm e2e:external-integration` passes
- [ ] `pnpm regression:db-persistence` passes

## 5) Callback Signature Integration

- [ ] Partner validates `X-Signature-HMAC-SHA256` successfully
- [ ] At least one successful signature verification is recorded

## 6) Idempotency Validation

- [ ] Same `Idempotency-Key` replay returns the same `CommandID`
- [ ] Partner retry policy and key generation policy are confirmed

## 7) Failure & Retry Validation

- [ ] Failed callback scenario shows `attempts=3`, `status=FAILED`, and `lastError`
- [ ] Operations panel can locate abnormal node/link

## 8) Restart Rehydration

- [ ] After API restart, `/commands` still returns existing command data
- [ ] After API restart, `/commands/alerts/timeouts` still returns existing alerts

## 9) Access & Security

- [ ] External endpoints reject unauthorized requests with `401`
- [ ] Security/audit events are queryable for rejected external auth attempts

## 10) Rollback Readiness

- [ ] Previous stable build artifact is available
- [ ] Rollback runbook is prepared (app rollback + config rollback + owner)
