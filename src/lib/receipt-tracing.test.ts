import { describe, expect, it } from "vitest";
import {
  buildReceiptTraceStart,
  buildReceiptTraceSuccess,
  estimateReceiptExtractionCost,
} from "./receipt-tracing";
import {
  extractDataUrlBase64,
  serializeBraintrustError,
} from "./trace-safety";
import { DEFAULT_VISION_MODEL } from "./vision-model-config";

describe("receipt tracing", () => {
  it("records only a boolean receipt-image summary at span start", () => {
    const trace = buildReceiptTraceStart({
      model: DEFAULT_VISION_MODEL,
      traceMarker: "privacy-test",
    });
    const serialized = JSON.stringify(trace);

    expect(trace.input.hasReceiptImage).toBe(true);
    expect(serialized).not.toContain("image_url");
    expect(serialized).not.toContain("base64");
  });

  it("records only a coarse extraction summary with usage and cost", () => {
    const privateItemName = "Private anniversary dinner";
    const trace = buildReceiptTraceSuccess({
      response: {
        id: "response-1",
        model: DEFAULT_VISION_MODEL,
        object: "chat.completion",
        choices: [{ finish_reason: "stop" }],
        usage: {
          prompt_tokens: 1_000,
          completion_tokens: 200,
          total_tokens: 1_200,
        },
      },
      receipt: {
        businessName: "Private Restaurant",
        date: "2026-07-24",
        billItems: [{ name: privateItemName, price: 987.65 }],
        tax: 12,
        tip: null,
      },
      model: DEFAULT_VISION_MODEL,
      durationMs: 2_500,
      providerDurationMs: 2_300,
    });
    const serialized = JSON.stringify(trace);

    expect(trace.output).toEqual({
      itemCount: 1,
      hasBusinessName: true,
      hasDate: true,
      hasTax: true,
      hasTip: false,
    });
    expect(trace.metrics).toMatchObject({
      duration_ms: 2_500,
      provider_duration_ms: 2_300,
      prompt_tokens: 1_000,
      completion_tokens: 200,
      total_tokens: 1_200,
      estimated_cost: 0.00022,
    });
    expect(serialized).not.toContain("Private Restaurant");
    expect(serialized).not.toContain(privateItemName);
    expect(serialized).not.toContain("2026-07-24");
    expect(serialized).not.toContain("987.65");
  });

  it("redacts receipt URLs, API keys, and raw data URL bytes from errors", () => {
    const secret = "together-secret-key";
    const receiptUrl = "data:image/jpeg;base64,cHJpdmF0ZS1yZWNlaXB0";
    const rawBase64 = extractDataUrlBase64(receiptUrl);
    const error = new Error(
      `Provider rejected ${secret}, ${receiptUrl}, and ${rawBase64}`,
    );
    const serialized = JSON.stringify(
      serializeBraintrustError(error, [secret, receiptUrl, rawBase64]),
    );

    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(receiptUrl);
    expect(serialized).not.toContain(rawBase64);
    expect(serialized).toContain("[REDACTED]");
  });

  it("estimates current production-model token cost", () => {
    expect(
      estimateReceiptExtractionCost(DEFAULT_VISION_MODEL, {
        prompt_tokens: 1_000,
        completion_tokens: 200,
        total_tokens: 1_200,
      }),
    ).toBe(0.00022);
    expect(
      estimateReceiptExtractionCost("unknown/model", {
        prompt_tokens: 1_000,
        completion_tokens: 200,
        total_tokens: 1_200,
      }),
    ).toBeNull();
  });
});
