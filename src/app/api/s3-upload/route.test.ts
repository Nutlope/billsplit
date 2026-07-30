import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_RECEIPT_UPLOAD_BYTES } from "../../../lib/image-upload";
import { POST } from "./route";

const originalEnvironment = {
  key: process.env.S3_UPLOAD_KEY,
  secret: process.env.S3_UPLOAD_SECRET,
  bucket: process.env.S3_UPLOAD_BUCKET,
  region: process.env.S3_UPLOAD_REGION,
};

beforeAll(() => {
  process.env.S3_UPLOAD_KEY = "test-access-key";
  process.env.S3_UPLOAD_SECRET = "test-secret-key";
  process.env.S3_UPLOAD_BUCKET = "test-bucket";
  process.env.S3_UPLOAD_REGION = "us-east-1";
});

afterAll(() => {
  restoreEnvironment("S3_UPLOAD_KEY", originalEnvironment.key);
  restoreEnvironment("S3_UPLOAD_SECRET", originalEnvironment.secret);
  restoreEnvironment("S3_UPLOAD_BUCKET", originalEnvironment.bucket);
  restoreEnvironment("S3_UPLOAD_REGION", originalEnvironment.region);
});

describe("POST /api/s3-upload", () => {
  it("creates a short-lived image-only S3 post and signed receipt URL", async () => {
    const response = await requestUpload({
      filename: "receipt.png",
      contentType: "image/png",
      size: MAX_RECEIPT_UPLOAD_BYTES,
    });
    const body = (await response.json()) as {
      fields: Record<string, string>;
      key: string;
      receiptUrl: string;
      token?: unknown;
    };

    expect(response.status).toBe(200);
    expect(body.key).toMatch(
      /^next-s3-uploads\/receipts\/[0-9a-f-]+\.png$/,
    );
    expect(body.fields["Content-Type"]).toBe("image/png");
    expect(body.fields["Content-Disposition"]).toBe(
      'attachment; filename="receipt.png"',
    );
    expect(body.token).toBeUndefined();

    const policy = JSON.parse(
      Buffer.from(body.fields.Policy, "base64").toString("utf8"),
    ) as { conditions: unknown[] };
    expect(policy.conditions).toContainEqual([
      "content-length-range",
      1,
      MAX_RECEIPT_UPLOAD_BYTES,
    ]);
    expect(policy.conditions).toContainEqual([
      "eq",
      "$Content-Type",
      "image/png",
    ]);

    const receiptUrl = new URL(body.receiptUrl);
    expect(receiptUrl.protocol).toBe("https:");
    expect(receiptUrl.searchParams.get("X-Amz-Algorithm")).toBe(
      "AWS4-HMAC-SHA256",
    );
  });

  it("rejects unsupported image types before signing", async () => {
    const response = await requestUpload({
      filename: "receipt.svg",
      contentType: "image/svg+xml",
      size: 1_024,
    });

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Only PNG and JPEG images are allowed",
    });
  });
});

function requestUpload(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/s3-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
