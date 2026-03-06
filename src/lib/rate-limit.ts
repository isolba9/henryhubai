const ipLimitMap = new Map<string, { count: number; resetTime: number }>();

const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, record] of ipLimitMap) {
    if (now > record.resetTime) {
      ipLimitMap.delete(key);
    }
  }
}

export function checkRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; retryAfter: number } {
  cleanup();

  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const record = ipLimitMap.get(key);

  if (!record || now > record.resetTime) {
    ipLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (record.count >= limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, retryAfter: 0 };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export const RATE_LIMITS = {
  AUTH: 5,
  STANDARD: 100,
} as const;
