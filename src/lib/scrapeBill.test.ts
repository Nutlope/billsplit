import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  endAndFlushBraintrustSpan: vi.fn(),
  logBraintrustEvent: vi.fn(),
  span: { id: "test-span" },
  startBraintrustSpan: vi.fn(),
}));

vi.mock("./clients", () => ({
  togetherBaseClient: {
    chat: {
      completions: {
        create: mocks.create,
      },
    },
  },
}));

vi.mock("./braintrust", () => ({
  endAndFlushBraintrustSpan: mocks.endAndFlushBraintrustSpan,
  logBraintrustEvent: mocks.logBraintrustEvent,
  startBraintrustSpan: mocks.startBraintrustSpan,
}));

import { DEFAULT_VISION_MODEL, scrapeBill } from "./scrapeBill";

const originalEnvironment = {
  braintrustApiKey: process.env.BRAINTRUST_API_KEY,
  togetherApiKey: process.env.TOGETHER_API_KEY,
};

describe("scrapeBill", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.endAndFlushBraintrustSpan.mockReset();
    mocks.logBraintrustEvent.mockReset();
    mocks.startBraintrustSpan.mockReset();
    mocks.startBraintrustSpan.mockReturnValue(mocks.span);
    process.env.BRAINTRUST_API_KEY = "braintrust-test-secret";
    process.env.TOGETHER_API_KEY = "together-test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnvironment(
      "BRAINTRUST_API_KEY",
      originalEnvironment.braintrustApiKey,
    );
    restoreEnvironment("TOGETHER_API_KEY", originalEnvironment.togetherApiKey);
  });

  it("uses the production vision model with schema-constrained, privacy-safe tracing", async () => {
    const billUrl = "https://private.example/receipt-private-marker.jpg";
    const response = {
      businessName: "Example Restaurant",
      date: "2026-07-24",
      billItems: [{ name: "Lunch", price: 12.5 }],
      tax: 1.25,
      tip: null,
    };

    mocks.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });

    await expect(scrapeBill({ billUrl })).resolves.toEqual(response);
    expect(DEFAULT_VISION_MODEL).toBe("Qwen/Qwen3.5-9B");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_VISION_MODEL,
        reasoning: { enabled: false },
        response_format: expect.objectContaining({
          type: "json_schema",
          json_schema: expect.objectContaining({
            name: "receipt",
            schema: expect.any(Object),
          }),
        }),
        messages: [
          expect.objectContaining({
            content: expect.arrayContaining([
              {
                type: "image_url",
                image_url: { url: billUrl },
              },
            ]),
          }),
        ],
      }),
    );
    expect(mocks.startBraintrustSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billsplit.extract-receipt",
        type: "llm",
        event: expect.objectContaining({
          input: { hasReceiptImage: true },
          metadata: expect.objectContaining({
            model: DEFAULT_VISION_MODEL,
          }),
        }),
      }),
    );
    expect(mocks.logBraintrustEvent).toHaveBeenCalledWith(
      mocks.span,
      expect.objectContaining({
        output: {
          itemCount: 1,
          hasBusinessName: true,
          hasDate: true,
          hasTax: true,
          hasTip: false,
        },
        metadata: expect.objectContaining({
          success: true,
          model: DEFAULT_VISION_MODEL,
        }),
      }),
    );
    expect(
      JSON.stringify(mocks.startBraintrustSpan.mock.calls),
    ).not.toContain(billUrl);
    const serializedTraceEvents = JSON.stringify([
      mocks.startBraintrustSpan.mock.calls,
      mocks.logBraintrustEvent.mock.calls,
    ]);
    expect(serializedTraceEvents).not.toContain("braintrust-test-secret");
    expect(serializedTraceEvents).not.toContain("together-test-secret");
    expect(serializedTraceEvents).not.toContain("Example Restaurant");
    expect(serializedTraceEvents).not.toContain("2026-07-24");
    expect(serializedTraceEvents).not.toContain("Lunch");
    expect(mocks.endAndFlushBraintrustSpan).toHaveBeenCalledWith(mocks.span);
  });

  it("redacts live environment secrets and the receipt URL from provider errors", async () => {
    const billUrl = "https://private.example/receipt-error-marker.jpg";
    const providerError = new Error(
      `Provider rejected together-test-secret, braintrust-test-secret, and ${billUrl}`,
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.create.mockRejectedValue(providerError);

    await expect(scrapeBill({ billUrl })).rejects.toBe(providerError);

    const serializedErrorEvent = JSON.stringify(
      mocks.logBraintrustEvent.mock.calls,
    );
    expect(serializedErrorEvent).not.toContain("together-test-secret");
    expect(serializedErrorEvent).not.toContain("braintrust-test-secret");
    expect(serializedErrorEvent).not.toContain(billUrl);
    expect(serializedErrorEvent).toContain("[REDACTED]");
    expect(mocks.endAndFlushBraintrustSpan).toHaveBeenCalledWith(mocks.span);
    consoleError.mockRestore();
  });
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
