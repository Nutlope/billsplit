type PresignedReceiptPost = {
  url: string;
  fields: Record<string, string>;
  key: string;
  receiptUrl: string;
};

export async function uploadReceiptImage(file: File) {
  const signResponse = await fetch("/api/s3-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!signResponse.ok) {
    throw new Error(
      await getErrorMessage(signResponse, "Receipt image is not allowed"),
    );
  }

  const post = (await signResponse.json()) as PresignedReceiptPost;
  const form = new FormData();
  for (const [name, value] of Object.entries(post.fields)) {
    form.append(name, value);
  }
  form.append("file", file);

  const uploadResponse = await fetch(post.url, {
    method: "POST",
    body: form,
  });
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload receipt image");
  }

  return { key: post.key, url: post.receiptUrl };
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}
