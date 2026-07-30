# Together vision-model migration for BillSplit

_Researched 2026-07-24 from current, first-party Together sources only._

## Recommendation

Use `Qwen/Qwen3.5-9B` as the production replacement.

All four current candidates produced schema-valid JSON on the focused live comparison once BillSplit used Together's documented structured-output request. Qwen had the best extraction score (90.28%), ahead of Kimi K2.6 (88.89%), MiniMax M3 (84.72%), and Gemma 4 (82.87%). It also has the lowest catalog price. A follow-up run across all eight active fixtures was 8/8 schema-valid with a 93.84% extraction score.

This is an application-specific choice, not a presumed model-lineage successor. Together publishes no successor mapping and its current general guidance is inconsistent: the [recommended-models page](https://docs.together.ai/docs/inference/recommended-models) names Kimi K2.6 for vision, while the [serverless catalog](https://docs.together.ai/docs/serverless/models) says to start with Qwen3.5 9B. Together's [structured OCR quickstart](https://docs.together.ai/docs/quickstart-how-to-do-ocr) explicitly describes receipt processing for `usebillsplit.com` with Gemma 4, but BillSplit's own fixtures are stronger evidence for this deployment.

## BillSplit's required inference contract

`src/lib/scrapeBill.ts` sends one remote `image_url` plus an extraction prompt to Chat Completions and expects JSON matching a Zod-derived schema:

- nullable business name, date, tax, and tip;
- a required array of `{ name: string, price: number }` items;
- deterministic extraction (`temperature: 0`) within 1,000 output tokens.

Together's current [structured extraction with vision](https://docs.together.ai/docs/inference/vision/structured-extraction) documentation confirms this exact capability: an `image_url` content block can be combined with a JSON Schema in `response_format`, and the returned JSON conforms to the supplied schema. The current documented TypeScript envelope is:

```ts
response_format: {
  type: "json_schema",
  json_schema: {
    name: "receipt",
    schema: jsonSchema,
  },
}
```

That differs from BillSplit's previous legacy-shaped `{ type: "json_object", schema: jsonSchema }`. Model support alone was therefore not enough; the migration also had to exercise the documented request shape (and disable reasoning) in the focused eval.

## Current eligible serverless candidates

Together's live catalog lists five serverless vision models. The four requested candidates all also appear in the catalog's chat table with **Structured outputs: Yes**. No removal is listed for any of these four on the current deprecation page.

| Model | Image input | Structured output | Serverless context | Current price / 1M tokens (input / output) | BillSplit assessment |
| --- | --- | --- | ---: | ---: | --- |
| `google/gemma-4-31B-it` | Yes | Yes | 262,144 | $0.39 / $0.97 | Together's current BillSplit/receipt/Zod example uses it, but it scored lower than Qwen on the focused live eval. |
| `Qwen/Qwen3.5-9B` | Yes | Yes | 262,144 | $0.17 / $0.25 | Selected default. Together labels it high-speed, reports 89.2% OCRBench on its [model page](https://www.together.ai/models/qwen3-5-9b), and the serverless catalog says to start with it for vision. |
| `MiniMaxAI/MiniMax-M3` | Yes | Yes | 524,288 | $0.30 / $1.20 | Viable challenger. Together's [model page](https://www.together.ai/models/minimax-m3) calls it natively multimodal and reports strong OmniDocBench positioning, but its documented emphasis is coding and long-horizon agents rather than receipt extraction. |
| `moonshotai/Kimi-K2.6` | Yes | Yes | 262,144 | $1.20 / $4.50 | Viable quality ceiling. Together's general recommendations select it for vision, and the structured-vision guide demonstrates schema extraction with it, but it is about 3.1× Gemma's input price and 4.6× its output price. |

The fifth current catalog entry, `moonshotai/Kimi-K2.7-Code` ($0.95 input / $4.00 output per 1M tokens), supports vision and structured outputs but is explicitly positioned for coding agents. There is no stronger official receipt-extraction evidence for it, so it should not displace the four focused candidates.

Prices and serverless context limits above come from Together's current [serverless models catalog](https://docs.together.ai/docs/serverless/models). The catalog is preferred where marketing model pages show an older price or a checkpoint-level context claim that differs from the deployed serverless limit.

## Models that must be removed from the eval recommendation set

Together's deprecation record lists these current BillSplit production/eval entries as already removed from serverless:

- `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` — removed 2026-03-31;
- `meta-llama/Llama-4-Scout-17B-16E-Instruct` — removed 2026-02-06;
- `Qwen/Qwen2.5-VL-72B-Instruct` — removed 2026-01-05;
- `moonshotai/Kimi-K2.5` — removed 2026-05-21;
- `ServiceNow-AI/Apriel-1.5-15b-Thinker` and `ServiceNow-AI/Apriel-1.6-15b-Thinker` — removed 2026-04-03.

`google/gemma-3n-E4B-it` is still callable only until its scheduled 2026-08-04 removal and should also be excluded from any forward-looking evaluation. `Qwen/Qwen3.5-397B-A17B`, formerly a plausible larger Qwen alternative, was removed 2026-06-29 and is not a fallback.

## Focused live validation

Using the same prompt, Zod schema, token limit, and reasoning-disabled setting, three representative fixtures produced:

| Model | Schema-valid | Extraction score | Mean latency | Median latency |
| --- | ---: | ---: | ---: | ---: |
| `Qwen/Qwen3.5-9B` | 3/3 | 90.28% | 6,251 ms | 6,235 ms |
| `moonshotai/Kimi-K2.6` | 3/3 | 88.89% | 3,268 ms | 3,231 ms |
| `MiniMaxAI/MiniMax-M3` | 3/3 | 84.72% | 3,203 ms | 2,689 ms |
| `google/gemma-4-31B-it` | 3/3 | 82.87% | 10,039 ms | 5,734 ms |

The requests ran concurrently, so these latency samples are directional rather than load-test percentiles. Correctness and schema validity were the primary decision criteria. Qwen then passed all eight active receipt fixtures with 8/8 schema-valid responses, a 93.84% extraction score, 6,686 ms mean latency, and 7,143 ms median latency.

## Official sources

- [Serverless model catalog](https://docs.together.ai/docs/serverless/models)
- [Model recommendations](https://docs.together.ai/docs/inference/recommended-models)
- [Deprecation policy and history](https://docs.together.ai/docs/deprecations)
- [Structured extraction with vision](https://docs.together.ai/docs/inference/vision/structured-extraction)
- [Structured outputs](https://docs.together.ai/docs/inference/chat/structured-outputs)
- [Structured OCR / BillSplit receipt quickstart](https://docs.together.ai/docs/quickstart-how-to-do-ocr)
- [Qwen3.5 9B model page](https://www.together.ai/models/qwen3-5-9b)
- [Gemma 4 31B model page](https://www.together.ai/models/gemma-4-31b)
- [MiniMax M3 model page](https://www.together.ai/models/minimax-m3)
- [Kimi K2.6 model page](https://www.together.ai/models/kimi-k26)
