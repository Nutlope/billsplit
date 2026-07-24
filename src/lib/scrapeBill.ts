import { z } from "zod";
import { togetherBaseClient } from "./clients";
import dedent from "dedent";
import {
  endAndFlushBraintrustSpan,
  logBraintrustEvent,
  startBraintrustSpan,
} from "./braintrust";
import {
  buildReceiptTraceStart,
  buildReceiptTraceSuccess,
} from "./receipt-tracing";
import {
  extractDataUrlBase64,
  serializeBraintrustError,
} from "./trace-safety";
import {
  DEFAULT_VISION_MODEL,
  RECEIPT_TRACE_PHASES,
  type ReceiptTracePhase,
} from "./vision-model-config";

export { DEFAULT_VISION_MODEL } from "./vision-model-config";

export const extractSchema = z.object({
  businessName: z
    .string()
    .nullable()
    .describe("Name of the business where the bill was created"),
  date: z.string().nullable().describe("Date when the bill was created"),
  billItems: z
    .array(
      z.object({
        name: z.string().describe("Name of the item"),
        price: z.number().describe("Price of the item in decimal format"),
      })
    )
    .describe("List of items in the bill"),
  tax: z
    .number()
    .nullable()
    .describe("Tax amount, not percentage we need money amount"),
  tip: z
    .number()
    .nullable()
    .describe(
      "Tip or Gratuity amount, not percentage we need money amount and if multiple tips are shown just output the medium one"
    ),
});

export type ExtractSchemaType = z.infer<typeof extractSchema>;

const systemPrompt = dedent`
  You are a receipt data extraction API. You receive receipt images and must return valid JSON data.

  REQUIRED OUTPUT FORMAT: Return ONLY a valid JSON object matching this exact schema:
  {
    "businessName": "string or null",
    "date": "string or null",
    "billItems": [{"name": "string", "price": number}],
    "tax": number or null,
    "tip": number or null
  }

  Do not include any text before or after the JSON. Do not explain your reasoning. Do not use markdown.

  Extraction rules:
  - businessName: Main restaurant/business name from receipt header, or null. Clean and normalize the name.
  - date: Receipt date in YYYY-MM-DD format, or null. Use 4-digit year, 2-digit month (with leading zero if needed), 2-digit day (with leading zero if needed).
  - billItems: Array of objects with "name" (clean item name without quantity prefixes like "1 x" or "2x") and "price" (decimal number as shown)
  - tax: Tax amount as decimal number, or null
  - tip: Tip/gratuity amount as decimal number, or null

  IMPORTANT CLEANUP RULES:
  - Item names: Remove quantity indicators like "1 x", "2x", "Qty:", etc. Just extract the clean item name.
  - Business names: Extract the main business name, not document headers or other text.
  - Dates: Always format as YYYY-MM-DD with proper leading zeros.
  - Prices: Keep as decimal numbers exactly as shown on receipt.
 `;

export async function scrapeBill({
  billUrl,
  model = DEFAULT_VISION_MODEL,
}: {
  billUrl: string;
  model?: string;
}): Promise<ExtractSchemaType> {
  const jsonSchema = z.toJSONSchema(extractSchema, {
    target: "openapi-3.0",
  });

  const span = startBraintrustSpan({
    name: "billsplit.extract-receipt",
    type: "llm",
    event: buildReceiptTraceStart({
      model,
      traceMarker: process.env.BRAINTRUST_TRACE_MARKER,
    }),
  });
  const startedAt = performance.now();
  let providerStartedAt: number | undefined;
  let providerDurationMs: number | undefined;
  let phase: ReceiptTracePhase = RECEIPT_TRACE_PHASES.provider;

  try {
    providerStartedAt = performance.now();
    const completion = await togetherBaseClient.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image_url",
              image_url: {
                url: billUrl,
              },
            },
          ],
        },
      ],
      reasoning: { enabled: false },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "receipt",
          schema: jsonSchema,
        },
      },
      temperature: 0, // Make responses more deterministic
      max_tokens: 1000, // Limit response length
    });
    providerDurationMs = performance.now() - providerStartedAt;

    if (completion?.choices?.[0]?.message?.content) {
      let content = completion.choices[0].message.content.trim();

      // Handle cases where the model returns markdown code blocks
      if (content.startsWith("```json")) {
        content = content.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (content.startsWith("```")) {
        content = content.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      // Try to extract JSON from text that might contain explanations
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      phase = RECEIPT_TRACE_PHASES.responseValidation;
      const receipt = extractSchema.parse(JSON.parse(content));
      logBraintrustEvent(
        span,
        buildReceiptTraceSuccess({
          response: completion,
          receipt,
          model,
          durationMs: performance.now() - startedAt,
          providerDurationMs,
        }),
      );
      return receipt;
    }
    phase = RECEIPT_TRACE_PHASES.providerResponse;
    throw new Error(`No content returned from vision model: ${model}`);
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    const metrics: Record<string, number> = {
      duration_ms: durationMs,
    };
    if (providerDurationMs !== undefined) {
      metrics.provider_duration_ms = providerDurationMs;
    } else if (providerStartedAt !== undefined) {
      metrics.provider_duration_ms = performance.now() - providerStartedAt;
    }

    const traceError =
      phase === RECEIPT_TRACE_PHASES.responseValidation
        ? new Error("Vision response failed schema validation")
        : error;
    logBraintrustEvent(span, {
      error: serializeBraintrustError(traceError, [
        process.env.TOGETHER_API_KEY,
        process.env.BRAINTRUST_API_KEY,
        billUrl,
        extractDataUrlBase64(billUrl),
      ]),
      metadata: {
        success: false,
        phase,
        model,
      },
      metrics,
    });
    console.error(`Receipt extraction failed during ${phase}`);
    throw error;
  } finally {
    await endAndFlushBraintrustSpan(span);
  }
}
