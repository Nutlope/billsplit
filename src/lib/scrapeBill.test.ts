import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
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

import { DEFAULT_VISION_MODEL, scrapeBill } from "./scrapeBill";

describe("scrapeBill", () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  it("uses the production vision model with schema-constrained output", async () => {
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
  });
});
