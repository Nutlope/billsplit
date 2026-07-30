import { NextResponse } from "next/server";
import {
  parseReceiptUploadRequest,
  ReceiptUploadError,
} from "../../../lib/image-upload";
import { createReceiptUploadPost } from "../../../lib/s3-receipt-storage";

export async function POST(request: Request) {
  try {
    const upload = parseReceiptUploadRequest(await request.json());
    const post = await createReceiptUploadPost(upload);
    return NextResponse.json(post);
  } catch (error) {
    if (error instanceof ReceiptUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Failed to create receipt upload:", error);
    return NextResponse.json(
      { error: "Failed to create receipt upload" },
      { status: 500 },
    );
  }
}
