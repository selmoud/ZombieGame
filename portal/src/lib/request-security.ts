const DEFAULT_JSON_LIMIT = 512 * 1024;

export function isTrustedMutationRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const allowedOrigins = new Set<string>();
  try {
    allowedOrigins.add(new URL(request.url).origin);
  } catch {
    return false;
  }
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      allowedOrigins.add(new URL(appUrl).origin);
    } catch {
      return false;
    }
  }
  try {
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function readLimitedJson<T>(
  request: Request,
  maxBytes = DEFAULT_JSON_LIMIT,
): Promise<
  | { ok: true; value: T }
  | { ok: false; error: "INVALID_JSON" | "PAYLOAD_TOO_LARGE" }
> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, error: "PAYLOAD_TOO_LARGE" };
  }
  if (!request.body) return { ok: false, error: "INVALID_JSON" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, error: "PAYLOAD_TOO_LARGE" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(bytes)) as T,
    };
  } catch {
    return { ok: false, error: "INVALID_JSON" };
  }
}

export function isSafeJsonValue(
  value: unknown,
  limits = {
    maxDepth: 8,
    maxNodes: 5_000,
    maxStringLength: 50_000,
    maxArrayLength: 250,
    maxObjectKeys: 250,
  },
) {
  let nodes = 0;
  const visit = (candidate: unknown, depth: number): boolean => {
    nodes += 1;
    if (nodes > limits.maxNodes || depth > limits.maxDepth) return false;
    if (typeof candidate === "string") {
      return candidate.length <= limits.maxStringLength;
    }
    if (
      candidate === null ||
      typeof candidate === "boolean" ||
      typeof candidate === "number"
    ) {
      return typeof candidate !== "number" || Number.isFinite(candidate);
    }
    if (Array.isArray(candidate)) {
      return (
        candidate.length <= limits.maxArrayLength &&
        candidate.every((item) => visit(item, depth + 1))
      );
    }
    if (typeof candidate === "object") {
      const entries = Object.entries(candidate);
      return (
        entries.length <= limits.maxObjectKeys &&
        entries.every(
          ([key, item]) =>
            key.length <= 160 && visit(item, depth + 1),
        )
      );
    }
    return false;
  };
  return visit(value, 0);
}
