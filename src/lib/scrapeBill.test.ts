import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  endAndFlushBraintrustSpan: vi.fn(),
  logBraintrustEvent: vi.fn(),
  sanitizedBraintrustError: vi.fn(),
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
  sanitizedBraintrustError: mocks.sanitizedBraintrustError,
  startBraintrustSpan: mocks.startBraintrustSpan,
}));

import { DEFAULT_VISION_MODEL, scrapeBill } from "./scrapeBill";

describe("scrapeBill", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.endAndFlushBraintrustSpan.mockReset();
    mocks.logBraintrustEvent.mockReset();
    mocks.sanitizedBraintrustError.mockReset();
    mocks.startBraintrustSpan.mockReset();
    mocks.startBraintrustSpan.mockReturnValue(mocks.span);
  });

  it("uses the production vision model with schema-constrained, privacy-safe tracing", async () => {
    const billUrl = "https://example.com/receipt.jpg";
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
    expect(JSON.stringify(mocks.logBraintrustEvent.mock.calls)).not.toContain(
      "Example Restaurant",
    );
    expect(mocks.endAndFlushBraintrustSpan).toHaveBeenCalledWith(mocks.span);
  });
});
