import type { ExtractSchemaType } from "./scrapeBill";

type ReceiptTraceInput = {
  model: string;
  traceMarker?: string;
};

type TogetherChatResponse = {
  id?: string;
  model?: string;
  object?: unknown;
  choices?: Array<{
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
};

const MODEL_PRICING_PER_MILLION_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "Qwen/Qwen3.5-9B": {
    input: 0.17,
    output: 0.25,
  },
};

export function buildReceiptTraceStart({
  model,
  traceMarker,
}: ReceiptTraceInput) {
  return {
    input: {
      hasReceiptImage: true,
    },
    metadata: {
      provider: "together",
      operation: "receipt-extraction",
      route: "/api/vision",
      model,
      schema: "receipt-v1",
      ...(traceMarker ? { traceMarker } : {}),
    },
  };
}

export function estimateReceiptExtractionCost(
  model: string,
  usage: TogetherChatResponse["usage"],
) {
  const pricing = MODEL_PRICING_PER_MILLION_TOKENS[model];
  if (!pricing || !usage) return null;

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  return Number(
    (
      (promptTokens * pricing.input + completionTokens * pricing.output) /
      1_000_000
    ).toFixed(12),
  );
}

export function buildReceiptTraceSuccess({
  response,
  receipt,
  model,
  durationMs,
  providerDurationMs,
}: {
  response: TogetherChatResponse;
  receipt: ExtractSchemaType;
  model: string;
  durationMs: number;
  providerDurationMs: number;
}) {
  const usage = response.usage ?? null;
  const estimatedCost = estimateReceiptExtractionCost(model, usage);
  const metrics: Record<string, number> = {
    duration_ms: durationMs,
    provider_duration_ms: providerDurationMs,
  };

  if (usage?.prompt_tokens !== undefined) {
    metrics.prompt_tokens = usage.prompt_tokens;
  }
  if (usage?.completion_tokens !== undefined) {
    metrics.completion_tokens = usage.completion_tokens;
  }
  if (usage?.total_tokens !== undefined) {
    metrics.total_tokens = usage.total_tokens;
  }
  if (estimatedCost !== null) {
    metrics.estimated_cost = estimatedCost;
  }

  return {
    output: {
      itemCount: receipt.billItems.length,
      hasBusinessName: receipt.businessName !== null,
      hasDate: receipt.date !== null,
      hasTax: receipt.tax !== null,
      hasTip: receipt.tip !== null,
    },
    metadata: {
      success: true,
      phase: "response-validation",
      model,
      responseId: response.id ?? null,
      responseModel: response.model ?? null,
      responseObject: response.object ?? null,
      finishReason: response.choices?.[0]?.finish_reason ?? null,
      usage,
      pricing:
        estimatedCost === null
          ? null
          : {
              currency: "USD",
              pricingUnit: "million_tokens",
              input: MODEL_PRICING_PER_MILLION_TOKENS[model].input,
              output: MODEL_PRICING_PER_MILLION_TOKENS[model].output,
            },
    },
    metrics,
  };
}
