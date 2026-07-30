export const DEFAULT_VISION_MODEL = "Qwen/Qwen3.5-9B";

export const VISION_MODEL_PRICING_PER_MILLION_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  [DEFAULT_VISION_MODEL]: {
    input: 0.17,
    output: 0.25,
  },
};

export const RECEIPT_TRACE_PHASES = {
  provider: "provider",
  providerResponse: "provider-response",
  responseValidation: "response-validation",
} as const;

export type ReceiptTracePhase =
  (typeof RECEIPT_TRACE_PHASES)[keyof typeof RECEIPT_TRACE_PHASES];
