import { execFileSync } from "node:child_process";
import {
  DEFAULT_VISION_MODEL,
  RECEIPT_TRACE_PHASES,
} from "../src/lib/vision-model-config";

const marker = requiredEnv("TRACE_MARKER");
const project = process.env.BRAINTRUST_PROJECT ?? "billsplit";
const sensitiveValues = [
  requiredEnv("TOGETHER_API_KEY"),
  requiredEnv("BRAINTRUST_API_KEY"),
  requiredEnv("TRACE_RECEIPT_URL"),
  requiredEnv("TRACE_BUSINESS_NAME"),
  requiredEnv("TRACE_ITEM_NAME"),
  requiredEnv("TRACE_DATE"),
];

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

type LogRow = {
  error: unknown;
  input: Record<string, unknown> | null;
  is_root: boolean;
  metadata: Record<string, unknown> | null;
  metrics: Record<string, number>;
  output: Record<string, unknown> | null;
  root_span_id: string;
  span_attributes: { name?: string };
  span_id: string;
};

function queryRows(): LogRow[] {
  const output = execFileSync(
    "node_modules/.bin/bt",
    [
      "view",
      "logs",
      "-p",
      project,
      "--no-input",
      "--quiet",
      "--json",
      "--window",
      "30m",
      "--limit",
      "20",
      "--preview-length",
      "100000",
      "--list-mode",
      "spans",
      "--search",
      marker,
    ],
    { encoding: "utf8" },
  );

  const result = JSON.parse(output) as { items?: Array<{ row: LogRow }> };
  return result.items?.map((item) => item.row) ?? [];
}

async function main() {
  let rows: LogRow[] = [];
  for (let attempt = 0; attempt < 15; attempt += 1) {
    rows = queryRows();
    if (
      rows.some((row) => row.metadata?.success === true || row.error != null)
    ) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  const trace = rows.find(
    (row) => row.span_attributes.name === "billsplit.extract-receipt",
  );
  const serialized = JSON.stringify(trace ?? null);
  const failures = [
    [Boolean(trace), "receipt extraction span is missing"],
    [trace?.is_root === true, "receipt extraction span is not a root span"],
    [trace?.error == null, "receipt extraction span contains an error"],
    [trace?.metadata?.success === true, "extraction is not marked successful"],
    [
      trace?.metadata?.model === DEFAULT_VISION_MODEL,
      "production model metadata is wrong",
    ],
    [
      trace?.metadata?.phase === RECEIPT_TRACE_PHASES.responseValidation,
      "success phase is wrong",
    ],
    [trace?.input?.hasReceiptImage === true, "safe input summary is missing"],
    [
      typeof trace?.output?.itemCount === "number",
      "output item count is missing",
    ],
    [(trace?.metrics.duration_ms ?? 0) > 0, "latency metric is missing"],
    [(trace?.metrics.total_tokens ?? 0) > 0, "token usage is missing"],
    [(trace?.metrics.estimated_cost ?? 0) > 0, "estimated cost is missing"],
    [!serialized.includes("http"), "trace contains a URL"],
    [!serialized.includes("image_url"), "trace contains an image URL field"],
    [!serialized.includes("data:image"), "trace contains image payload bytes"],
    [!serialized.includes("billItems"), "trace contains extracted bill items"],
    [
      !serialized.includes("businessName"),
      "trace contains the extracted business name field",
    ],
    [
      sensitiveValues.every((value) => !serialized.includes(value)),
      "trace contains a configured secret or receipt-content marker",
    ],
  ].filter(([passed]) => !passed);

  if (failures.length > 0) {
    throw new Error(
      `Braintrust trace verification failed:\n${failures
        .map(([, message]) => `- ${message}`)
        .join("\n")}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        rootSpanId: trace?.root_span_id,
        spanId: trace?.span_id,
        span: trace?.span_attributes.name,
        model: trace?.metadata?.model,
        itemCount: trace?.output?.itemCount,
        durationMs: trace?.metrics.duration_ms,
        totalTokens: trace?.metrics.total_tokens,
        estimatedCostUsd: trace?.metrics.estimated_cost,
        privacyChecksPassed: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
