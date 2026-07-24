import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  createReceiptObjectKey,
  RECEIPT_DOWNLOAD_EXPIRY_SECONDS,
  RECEIPT_UPLOAD_EXPIRY_SECONDS,
  type ReceiptUploadRequest,
} from "./image-upload";
import { getS3 } from "./s3";

const RECEIPT_CACHE_CONTROL = "private, no-store, max-age=0";

export async function createReceiptUploadPost(
  request: ReceiptUploadRequest,
) {
  const { bucket, client } = getS3();
  const key = createReceiptObjectKey(request.extension);
  const contentDisposition = `attachment; filename="receipt.${request.extension}"`;

  const [post, receiptUrl] = await Promise.all([
    createPresignedPost(client, {
      Bucket: bucket,
      Key: key,
      Expires: RECEIPT_UPLOAD_EXPIRY_SECONDS,
      Fields: {
        "Content-Type": request.contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": RECEIPT_CACHE_CONTROL,
      },
      Conditions: [
        ["eq", "$Content-Type", request.contentType],
        ["eq", "$Content-Disposition", contentDisposition],
        ["eq", "$Cache-Control", RECEIPT_CACHE_CONTROL],
        ["content-length-range", 1, request.size],
      ],
    }),
    getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: RECEIPT_DOWNLOAD_EXPIRY_SECONDS },
    ),
  ]);

  return {
    ...post,
    key,
    receiptUrl,
    expiresIn: RECEIPT_UPLOAD_EXPIRY_SECONDS,
    maxBytes: request.size,
  };
}
