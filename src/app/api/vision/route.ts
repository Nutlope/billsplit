import { scrapeBill } from "../../../lib/scrapeBill";
import { receiptUrlMatchesKey } from "../../../lib/image-upload";
import { removeReceiptObject } from "../../../lib/s3-receipt-storage";

export async function POST(req: Request) {
  const { billUrl, billKey } = await req.json();

  const start = new Date();
  try {
    const output = await scrapeBill({
      billUrl,
    });
    const endJson = new Date();

    console.log(
      "Time it took to generate Bill JSON: ",
      (endJson.getTime() - start.getTime()) / 1000,
    );

    return Response.json(output);
  } finally {
    if (
      receiptUrlMatchesKey(billUrl, billKey, {
        bucket: process.env.S3_UPLOAD_BUCKET,
        region: process.env.S3_UPLOAD_REGION,
      })
    ) {
      try {
        await removeReceiptObject(billKey);
      } catch {
        console.warn("Failed to remove processed receipt upload");
      }
    }
  }
}
