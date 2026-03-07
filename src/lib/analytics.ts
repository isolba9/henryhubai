let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
  userId?: string
): void {
  try {
    const payload = {
      event,
      properties: properties || {},
      sessionId: getSessionId(),
      userId: userId || null,
      pagePath: window.location.pathname,
      referrer: document.referrer || null,
    };

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", body);
    } else {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics must never throw
  }
}
