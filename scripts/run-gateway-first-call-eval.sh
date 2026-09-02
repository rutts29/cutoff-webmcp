#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${AI_GATEWAY_API_KEY:-}" ]]; then
  echo "AI_GATEWAY_API_KEY is required." >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
schema_file="$project_dir/evals/schema.json"
cases_file="$project_dir/evals/cases.local.json"
output_file="${1:-$project_dir/evals/gateway-gemini-3.7-first-call.json}"
model="google/gemini-3.7-flash"
endpoint="https://ai-gateway.vercel.sh/v1/chat/completions"
system_prompt="You are an agent helping a user navigate a page via the tools made available to you. Use the provided tools to query page content when needed. Do not use tools other than the available ones. Never use more tool calls than necessary. Today's date is Wed Sep 2 2026."

request_file="$(mktemp -t cutoff-gateway-request.XXXXXX)"
response_file="$(mktemp -t cutoff-gateway-response.XXXXXX)"
results_file="$(mktemp -t cutoff-gateway-results.XXXXXX)"
updated_results_file="$(mktemp -t cutoff-gateway-updated.XXXXXX)"
trap 'rm -f "$request_file" "$response_file" "$results_file" "$updated_results_file"' EXIT

printf '[]\n' > "$results_file"
blocked="false"

while IFS= read -r case_json; do
  case_name="$(jq -r '.name' <<<"$case_json")"
  expected_call="$(jq -r '.expectedCall[0].functionName' <<<"$case_json")"

  jq -n \
    --arg model "$model" \
    --arg system "$system_prompt" \
    --argjson case "$case_json" \
    --slurpfile schema "$schema_file" \
    '{
      model: $model,
      messages: (
        [{ role: "system", content: $system }]
        + [$case.messages[] | { role, content }]
      ),
      tools: (
        $schema[0].tools
        | map({
            type: "function",
            function: {
              name: .name,
              description: .description,
              parameters: .inputSchema
            }
          })
      ),
      tool_choice: "auto",
      stream: false
    }' > "$request_file"

  http_status="$(
    curl --silent --show-error \
      --output "$response_file" \
      --write-out '%{http_code}' \
      --request POST "$endpoint" \
      --header "Authorization: Bearer $AI_GATEWAY_API_KEY" \
      --header "Content-Type: application/json" \
      --data-binary "@$request_file"
  )"

  if [[ "$http_status" == "200" ]]; then
    actual_calls="$(jq -c '[.choices[0].message.tool_calls[]?.function.name]' "$response_file")"
    first_call="$(jq -r '.[0] // ""' <<<"$actual_calls")"
    call_count="$(jq 'length' <<<"$actual_calls")"
    finish_reason="$(jq -r '.choices[0].finish_reason // "unknown"' "$response_file")"
    usage="$(jq -c '{promptTokens: (.usage.prompt_tokens // 0), completionTokens: (.usage.completion_tokens // 0), totalTokens: (.usage.total_tokens // 0)}' "$response_file")"

    if [[ "$first_call" == "$expected_call" && "$call_count" == "1" ]]; then
      outcome="pass"
    else
      outcome="fail"
    fi

    result="$(
      jq -n \
        --arg name "$case_name" \
        --arg expected "$expected_call" \
        --argjson actual "$actual_calls" \
        --arg outcome "$outcome" \
        --arg finish "$finish_reason" \
        --argjson usage "$usage" \
        '{
          name: $name,
          expectedFirstCall: $expected,
          actualCalls: $actual,
          outcome: $outcome,
          finishReason: $finish,
          usage: $usage
        }'
    )"
  else
    error_message="$(jq -r '.error.message // "Gateway request failed."' "$response_file" 2>/dev/null || echo "Gateway request failed.")"
    result="$(
      jq -n \
        --arg name "$case_name" \
        --arg expected "$expected_call" \
        --arg status "$http_status" \
        --arg message "$error_message" \
        '{
          name: $name,
          expectedFirstCall: $expected,
          actualCalls: [],
          outcome: "error",
          httpStatus: ($status | tonumber),
          error: $message
        }'
    )"
  fi

  jq --argjson result "$result" '. + [$result]' "$results_file" > "$updated_results_file"
  mv "$updated_results_file" "$results_file"

  if [[ "$(jq -r '.outcome' <<<"$result")" == "error" ]]; then
    blocked="true"
    break
  fi
done < <(jq -c '.[]' "$cases_file")

total_cases="$(jq 'length' "$cases_file")"
attempted_cases="$(jq 'length' "$results_file")"
scored_cases="$(jq '[.[] | select(.outcome == "pass" or .outcome == "fail")] | length' "$results_file")"
passed_cases="$(jq '[.[] | select(.outcome == "pass")] | length' "$results_file")"
failed_cases="$(jq '[.[] | select(.outcome == "fail")] | length' "$results_file")"
created_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

if [[ "$blocked" == "true" ]]; then
  status="blocked"
else
  status="complete"
fi

mkdir -p "$(dirname "$output_file")"
jq -n \
  --arg createdAt "$created_at" \
  --arg model "$model" \
  --arg endpoint "$endpoint" \
  --arg status "$status" \
  --argjson totalCases "$total_cases" \
  --argjson attemptedCases "$attempted_cases" \
  --argjson scoredCases "$scored_cases" \
  --argjson passedCases "$passed_cases" \
  --argjson failedCases "$failed_cases" \
  --slurpfile results "$results_file" \
  '{
    createdAt: $createdAt,
    transport: "curl",
    api: "openai-chat-completions",
    model: $model,
    endpoint: $endpoint,
    status: $status,
    totalCases: $totalCases,
    attemptedCases: $attemptedCases,
    scoredCases: $scoredCases,
    passedCases: $passedCases,
    failedCases: $failedCases,
    results: $results[0]
  }' > "$output_file"

echo "Report: $output_file"

if [[ "$blocked" == "true" ]]; then
  echo "Gemini first-call eval blocked after $attempted_cases request. No model result was scored."
  exit 3
fi

echo "Gemini first-call eval: $passed_cases/$total_cases passed."

if [[ "$failed_cases" != "0" || "$scored_cases" != "$total_cases" ]]; then
  exit 1
fi
