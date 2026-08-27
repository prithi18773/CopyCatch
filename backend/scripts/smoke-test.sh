#!/usr/bin/env bash
# End-to-end smoke test against a running backend.
#
# Usage:
#   ./smoke-test.sh [path-to-submissions.zip] [api-base-url]
#
# Defaults to ./sample-submissions.zip and http://localhost:5000

set -euo pipefail

ZIP_PATH="${1:-sample-submissions.zip}"
BASE_URL="${2:-http://localhost:5000}"

if ! command -v curl >/dev/null; then
  echo "curl is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null; then
  echo "jq is required (brew install jq / apt install jq)" >&2
  exit 1
fi
if [ ! -f "$ZIP_PATH" ]; then
  echo "Zip not found: $ZIP_PATH" >&2
  exit 1
fi

echo "==> Health check"
curl -sf "$BASE_URL/api/health" | jq .

echo "==> Uploading $ZIP_PATH"
UPLOAD_RESPONSE=$(curl -sf -X POST "$BASE_URL/api/batches/upload" \
  -F "zipFile=@${ZIP_PATH}" \
  -F "name=Smoke Test Batch")
echo "$UPLOAD_RESPONSE" | jq .

BATCH_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.batchId')
if [ "$BATCH_ID" = "null" ] || [ -z "$BATCH_ID" ]; then
  echo "Upload failed - no batchId returned" >&2
  exit 1
fi

echo "==> Polling batch $BATCH_ID"
STATUS="processing"
ATTEMPTS=0
while [ "$STATUS" = "processing" ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -gt 30 ]; then
    echo "Timed out waiting for batch to complete" >&2
    exit 1
  fi
  sleep 2
  BATCH=$(curl -sf "$BASE_URL/api/batches/$BATCH_ID")
  STATUS=$(echo "$BATCH" | jq -r '.status')
  echo "   status=$STATUS (attempt $ATTEMPTS)"
done

echo "==> Final batch state"
echo "$BATCH" | jq .

if [ "$STATUS" = "failed" ]; then
  echo "Batch processing failed" >&2
  exit 1
fi

echo "==> Flagged pairs"
curl -sf "$BASE_URL/api/batches/$BATCH_ID/pairs" | jq '.[] | {a: .submissionA.studentName, b: .submissionB.studentName, hashJaccard, similarity}'

echo "==> Cheating rings"
curl -sf "$BASE_URL/api/batches/$BATCH_ID/groups" | jq '.[] | {members: [.members[].studentName], maxSimilarity}'

echo "==> Done. Expect two rings: {alice,bob,dave} and {carol,erin}; frank should appear in neither."
