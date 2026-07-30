import { describe, expect, it } from "vitest";
import {
  assertReceiptObjectKey,
  MAX_RECEIPT_UPLOAD_BYTES,
  parseReceiptUploadRequest,
  receiptUrlMatchesKey,
  ReceiptUploadError,
} from "./image-upload";

describe("receipt upload validation", () => {
  it("accepts a matching JPEG filename, MIME type, and safe size", () => {
    expect(
      parseReceiptUploadRequest({
        filename: "receipt.jpeg",
        contentType: "image/jpeg",
        size: 1_024,
      }),
    ).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
      size: 1_024,
    });
  });

  it.each([
    {
      name: "SVG files",
      input: {
        filename: "receipt.svg",
        contentType: "image/svg+xml",
        size: 1_024,
      },
      status: 415,
    },
    {
      name: "oversized images",
      input: {
        filename: "receipt.png",
        contentType: "image/png",
        size: MAX_RECEIPT_UPLOAD_BYTES + 1,
      },
      status: 413,
    },
    {
      name: "mismatched extensions",
      input: {
        filename: "receipt.jpg",
        contentType: "image/png",
        size: 1_024,
      },
      status: 415,
    },
  ])("rejects $name", ({ input, status }) => {
    expect(() => parseReceiptUploadRequest(input)).toThrow(
      expect.objectContaining<Partial<ReceiptUploadError>>({ status }),
    );
  });

  it("accepts only generated receipt keys and matching signed URLs", () => {
    const key =
      "next-s3-uploads/receipts/2818b9b9-35ab-4a68-894c-2af4d59646fb.jpg";
    const receiptUrl = `https://bucket.s3.amazonaws.com/${key}?X-Amz-Signature=test`;
    const uploadConfig = { bucket: "bucket", region: "us-east-1" };

    expect(assertReceiptObjectKey(key)).toBe(key);
    expect(receiptUrlMatchesKey(receiptUrl, key, uploadConfig)).toBe(true);
    expect(
      receiptUrlMatchesKey(receiptUrl, `${key}.other`, uploadConfig),
    ).toBe(false);
    expect(
      receiptUrlMatchesKey(
        `https://attacker.example/${key}`,
        key,
        uploadConfig,
      ),
    ).toBe(false);
    expect(() => assertReceiptObjectKey("../other-object.jpg")).toThrow(
      expect.objectContaining<Partial<ReceiptUploadError>>({ status: 400 }),
    );
  });
});
