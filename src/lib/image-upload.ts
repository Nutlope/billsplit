export const MAX_RECEIPT_UPLOAD_BYTES = 15 * 1024 * 1024;
export const RECEIPT_UPLOAD_EXPIRY_SECONDS = 5 * 60;
export const RECEIPT_DOWNLOAD_EXPIRY_SECONDS = 10 * 60;

export type SupportedReceiptImageType = "image/jpeg" | "image/png";

const RECEIPT_IMAGE_TYPES: Record<
  SupportedReceiptImageType,
  { extension: "jpg" | "png"; acceptedExtensions: readonly string[] }
> = {
  "image/jpeg": {
    extension: "jpg",
    acceptedExtensions: ["jpg", "jpeg"],
  },
  "image/png": {
    extension: "png",
    acceptedExtensions: ["png"],
  },
};

export class ReceiptUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReceiptUploadError";
  }
}

export type ReceiptUploadRequest = {
  contentType: SupportedReceiptImageType;
  extension: "jpg" | "png";
  size: number;
};

export function parseReceiptUploadRequest(
  input: unknown,
): ReceiptUploadRequest {
  if (!isRecord(input)) {
    throw new ReceiptUploadError("Invalid upload request", 400);
  }

  const { filename, contentType, size } = input;
  if (
    typeof filename !== "string" ||
    filename.length === 0 ||
    filename.length > 255 ||
    typeof contentType !== "string" ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size)
  ) {
    throw new ReceiptUploadError("Invalid upload request", 400);
  }

  if (!isSupportedReceiptImageType(contentType)) {
    throw new ReceiptUploadError("Only PNG and JPEG images are allowed", 415);
  }

  if (size < 1) {
    throw new ReceiptUploadError("The receipt image is empty", 400);
  }

  if (size > MAX_RECEIPT_UPLOAD_BYTES) {
    throw new ReceiptUploadError(
      `Receipt images must be ${MAX_RECEIPT_UPLOAD_BYTES / 1024 / 1024} MB or smaller`,
      413,
    );
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  const imageType = RECEIPT_IMAGE_TYPES[contentType];
  if (!extension || !imageType.acceptedExtensions.includes(extension)) {
    throw new ReceiptUploadError(
      "The filename extension does not match the image type",
      415,
    );
  }

  return {
    contentType,
    extension: imageType.extension,
    size,
  };
}

export function createReceiptObjectKey(
  extension: ReceiptUploadRequest["extension"],
) {
  return `next-s3-uploads/receipts/${crypto.randomUUID()}.${extension}`;
}

export function assertReceiptObjectKey(key: unknown): string {
  if (
    typeof key !== "string" ||
    !/^next-s3-uploads\/receipts\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i.test(
      key,
    )
  ) {
    throw new ReceiptUploadError("Invalid receipt upload key", 400);
  }

  return key;
}

export function receiptUrlMatchesKey(
  receiptUrl: unknown,
  key: string,
  {
    bucket,
    region,
  }: {
    bucket: string | undefined;
    region: string | undefined;
  },
) {
  if (typeof receiptUrl !== "string" || !bucket || !region) return false;

  try {
    const url = new URL(receiptUrl);
    const allowedHosts = new Set([
      `${bucket}.s3.${region}.amazonaws.com`,
      `${bucket}.s3.amazonaws.com`,
    ]);
    return (
      url.protocol === "https:" &&
      allowedHosts.has(url.hostname) &&
      decodeURIComponent(url.pathname) === `/${key}`
    );
  } catch {
    return false;
  }
}

function isSupportedReceiptImageType(
  value: string,
): value is SupportedReceiptImageType {
  return Object.hasOwn(RECEIPT_IMAGE_TYPES, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
