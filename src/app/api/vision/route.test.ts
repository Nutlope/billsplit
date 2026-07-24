import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  removeReceiptObject: vi.fn(),
  scrapeBill: vi.fn(),
}));

vi.mock("../../../lib/scrapeBill", () => ({
  scrapeBill: mocks.scrapeBill,
}));

vi.mock("../../../lib/s3-receipt-storage", () => ({
  removeReceiptObject: mocks.removeReceiptObject,
}));

import { POST } from "./route";

const originalEnvironment = {
  bucket: process.env.S3_UPLOAD_BUCKET,
  region: process.env.S3_UPLOAD_REGION,
};
const billKey =
  "next-s3-uploads/receipts/2818b9b9-35ab-4a68-894c-2af4d59646fb.jpg";
const billUrl = `https://test-bucket.s3.us-east-1.amazonaws.com/${billKey}?X-Amz-Signature=test`;

beforeAll(() => {
  process.env.S3_UPLOAD_BUCKET = "test-bucket";
  process.env.S3_UPLOAD_REGION = "us-east-1";
});

afterAll(() => {
  restoreEnvironment("S3_UPLOAD_BUCKET", originalEnvironment.bucket);
  restoreEnvironment("S3_UPLOAD_REGION", originalEnvironment.region);
});

describe("POST /api/vision", () => {
  beforeEach(() => {
    mocks.removeReceiptObject.mockReset();
    mocks.scrapeBill.mockReset();
    mocks.removeReceiptObject.mockResolvedValue(undefined);
  });

  it("removes the uploaded receipt after successful extraction", async () => {
    const receipt = {
      businessName: "Nobu",
      date: "2020-02-13",
      billItems: [{ name: "Dinner", price: 10 }],
      tax: 1,
      tip: null,
    };
    mocks.scrapeBill.mockResolvedValue(receipt);

    const response = await POST(requestVision());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(receipt);
    expect(mocks.removeReceiptObject).toHaveBeenCalledWith(billKey);
  });

  it("removes the uploaded receipt when extraction fails", async () => {
    const extractionError = new Error("Provider failed");
    mocks.scrapeBill.mockRejectedValue(extractionError);

    await expect(POST(requestVision())).rejects.toBe(extractionError);
    expect(mocks.removeReceiptObject).toHaveBeenCalledWith(billKey);
  });

  it("does not remove keys associated with another host", async () => {
    mocks.scrapeBill.mockResolvedValue({
      businessName: null,
      date: null,
      billItems: [],
      tax: null,
      tip: null,
    });

    await POST(
      requestVision({
        billUrl: `https://attacker.example/${billKey}`,
        billKey,
      }),
    );

    expect(mocks.removeReceiptObject).not.toHaveBeenCalled();
  });
});

function requestVision(
  body: Record<string, unknown> = {
    billUrl,
    billKey,
  },
) {
  return new Request("http://localhost/api/vision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
