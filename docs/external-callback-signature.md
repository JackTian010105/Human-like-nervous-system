# External Callback Signature Verification

This project signs callback payloads with `HMAC-SHA256`.

## Headers

- `X-Signature-HMAC-SHA256`: hex digest signature

## Payload

Use the callback event JSON payload as the signature input.

## Verify Locally

1. Save the callback payload JSON as `/tmp/payload.json`.
2. Run:

```bash
pnpm verify:callback-signature /tmp/payload.json <signature-hex> <secret>
```

3. Output:

- `valid: true` means signature check passed.
- `valid: false` means signature check failed.

## Reference Formula

```text
signature = hex( HMAC_SHA256(secret, JSON.stringify(payload)) )
```
