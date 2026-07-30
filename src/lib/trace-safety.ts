export function serializeBraintrustError(
  error: unknown,
  sensitiveValues: Array<string | null | undefined> = [],
) {
  const deduped = Array.from(new Set(sensitiveValues)).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  const redact = (value: string | undefined) => {
    if (value === undefined) return undefined;

    let redacted = value;
    for (const sensitiveValue of deduped) {
      redacted = redacted.replaceAll(sensitiveValue, "[REDACTED]");
    }
    return redacted;
  };

  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message),
      stack: redact(error.stack),
    };
  }

  return { message: redact(String(error)) };
}

export function extractDataUrlBase64(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^data:[^;]*;base64,(.+)$/);
  return match?.[1];
}
