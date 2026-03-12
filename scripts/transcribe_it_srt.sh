#!/usr/bin/env bash

set -euo pipefail

if [[ "${1:-}" == "" ]]; then
  echo "Usage: $0 /path/to/audio.mp3 [output.srt]"
  exit 1
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Error: OPENAI_API_KEY is not set."
  echo "Set it first, for example:"
  echo "  export OPENAI_API_KEY='your_api_key'"
  exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-${INPUT_FILE%.*}.srt}"

if [[ ! -f "$INPUT_FILE" ]]; then
  echo "Error: file not found: $INPUT_FILE"
  exit 1
fi

curl -sS https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@$INPUT_FILE" \
  -F "model=whisper-1" \
  -F "language=it" \
  -F "response_format=srt" \
  -o "$OUTPUT_FILE"

echo "SRT saved to: $OUTPUT_FILE"
