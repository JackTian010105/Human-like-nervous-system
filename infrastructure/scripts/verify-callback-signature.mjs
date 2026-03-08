#!/usr/bin/env node
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

function usage() {
  console.log(
    [
      "Usage:",
      "  node infrastructure/scripts/verify-callback-signature.mjs <payload-json-file> <signature-hex> <secret>",
      "",
      "Example:",
      "  node infrastructure/scripts/verify-callback-signature.mjs /tmp/payload.json <hex> secret-123"
    ].join("\n")
  );
}

const [, , payloadPath, signatureHex, secret] = process.argv;

if (!payloadPath || !signatureHex || !secret) {
  usage();
  process.exit(1);
}

let payloadRaw = "";
try {
  payloadRaw = readFileSync(payloadPath, "utf8");
} catch (error) {
  console.error(`Failed to read payload file: ${payloadPath}`);
  console.error(String(error));
  process.exit(1);
}

let normalizedPayload = "";
try {
  // Canonicalize JSON to avoid whitespace/indent differences.
  normalizedPayload = JSON.stringify(JSON.parse(payloadRaw));
} catch {
  console.error("Payload file must be valid JSON.");
  process.exit(1);
}

const computed = createHmac("sha256", secret).update(normalizedPayload).digest("hex");
const valid = computed === signatureHex;

console.log(
  JSON.stringify(
    {
      valid,
      computedSignature: computed
    },
    null,
    2
  )
);

process.exit(valid ? 0 : 2);
