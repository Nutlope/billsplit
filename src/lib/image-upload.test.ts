import { describe, expect, it } from "vitest";
import {
  MAX_RECEIPT_UPLOAD_BYTES,
  parseReceiptUploadRequest,
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
});
