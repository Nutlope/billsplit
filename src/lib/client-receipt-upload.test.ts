import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadReceiptImage } from "./client-receipt-upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadReceiptImage", () => {
  it("requests a policy and uploads the file directly to S3", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          url: "https://test-bucket.s3.amazonaws.com",
          fields: {
            key: "next-s3-uploads/receipts/test.jpg",
            "Content-Type": "image/jpeg",
          },
          receiptUrl:
            "https://test-bucket.s3.amazonaws.com/next-s3-uploads/receipts/test.jpg?signed=true",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["receipt-bytes"], "receipt.jpg", {
      type: "image/jpeg",
    });

    await expect(uploadReceiptImage(file)).resolves.toEqual({
      url: "https://test-bucket.s3.amazonaws.com/next-s3-uploads/receipts/test.jpg?signed=true",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/s3-upload",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          filename: "receipt.jpg",
          contentType: "image/jpeg",
          size: file.size,
        }),
      }),
    );
    const [, uploadRequest] = fetchMock.mock.calls[1];
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://test-bucket.s3.amazonaws.com",
    );
    expect(uploadRequest?.method).toBe("POST");
    expect(uploadRequest?.body).toBeInstanceOf(FormData);
    const form = uploadRequest?.body as FormData;
    expect(form.get("key")).toBe("next-s3-uploads/receipts/test.jpg");
    expect(form.get("Content-Type")).toBe("image/jpeg");
    expect(form.get("file")).toBe(file);
  });

  it("surfaces safe signer errors without attempting an S3 upload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: "Only PNG and JPEG images are allowed" }, {
          status: 415,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadReceiptImage(
        new File(["svg"], "receipt.svg", { type: "image/svg+xml" }),
      ),
    ).rejects.toThrow("Only PNG and JPEG images are allowed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
