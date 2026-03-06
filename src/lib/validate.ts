export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

export function validateApiKey(key: unknown): string | null {
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  if (trimmed.length < 5 || trimmed.length > 300) return null;
  if (!/^[a-zA-Z0-9_\-.:]+$/.test(trimmed)) return null;
  return trimmed;
}

export function validateUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function validateIsoDate(date: unknown): string | null {
  if (typeof date !== "string") return null;
  const trimmed = date.trim();
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function validateModel(
  model: unknown
): "claude-opus-4-6" | "claude-sonnet-4-6" {
  if (model === "claude-opus-4-6") return "claude-opus-4-6";
  return "claude-sonnet-4-6";
}

export function validateMessages(
  messages: unknown
): Array<{ role: string; content: unknown }> {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        typeof m === "object" &&
        typeof m.role === "string" &&
        ["user", "assistant"].includes(m.role) &&
        m.content !== undefined
    )
    .slice(-50);
}

export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded", retryAfter }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export function errorResponse(message: string, status: number = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
