import crypto from "crypto";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

interface UserWithHash extends User {
  password_hash: string;
}

function supabaseUrl(): string {
  return process.env.SUPABASE_URL!;
}

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_ANON_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/* ── Password hashing (PBKDF2, no external deps) ── */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const testHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return hash === testHash;
}

/* ── Session helpers ── */

export function generateSessionToken(): string {
  return crypto.randomUUID();
}

export function getSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/hh_session=([^;]+)/);
  return match ? match[1] : null;
}

export function sessionCookieHeader(
  token: string,
  maxAge: number = 30 * 24 * 60 * 60
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `hh_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `hh_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* ── User CRUD ── */

export async function createUser(
  email: string,
  passwordHash: string,
  displayName?: string
): Promise<{ user?: User; error?: string }> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/users`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      display_name: displayName || email.split("@")[0],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409 || text.includes("duplicate") || text.includes("unique")) {
      return { error: "Email already registered" };
    }
    return { error: "Failed to create account" };
  }

  const data = await res.json();
  const u = data[0];
  if (!u) return { error: "Failed to create account" };
  return {
    user: {
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      created_at: u.created_at,
    },
  };
}

export async function findUserByEmail(
  email: string
): Promise<UserWithHash | null> {
  const res = await fetch(
    `${supabaseUrl()}/rest/v1/users?email=eq.${encodeURIComponent(
      email.toLowerCase().trim()
    )}&select=id,email,display_name,password_hash,created_at`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] || null;
}

/* ── Session CRUD ── */

export async function createSession(userId: string): Promise<string | null> {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const res = await fetch(`${supabaseUrl()}/rest/v1/sessions`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, token, expires_at: expiresAt }),
  });

  return res.ok ? token : null;
}

export async function validateSession(token: string): Promise<User | null> {
  // Find valid session
  const sessionRes = await fetch(
    `${supabaseUrl()}/rest/v1/sessions?token=eq.${encodeURIComponent(
      token
    )}&expires_at=gt.${new Date().toISOString()}&select=user_id`,
    { headers: supabaseHeaders() }
  );
  if (!sessionRes.ok) return null;
  const sessions = await sessionRes.json();
  if (!sessions[0]) return null;

  // Find user
  const userRes = await fetch(
    `${supabaseUrl()}/rest/v1/users?id=eq.${sessions[0].user_id}&select=id,email,display_name,created_at`,
    { headers: supabaseHeaders() }
  );
  if (!userRes.ok) return null;
  const users = await userRes.json();
  return users[0] || null;
}

export async function deleteSession(token: string): Promise<void> {
  await fetch(
    `${supabaseUrl()}/rest/v1/sessions?token=eq.${encodeURIComponent(token)}`,
    { method: "DELETE", headers: supabaseHeaders() }
  );
}

/* ── Conversation CRUD ── */

export async function createConversation(
  userId: string,
  title: string = "New conversation"
): Promise<string | null> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/conversations`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, title }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data[0]?.id || null;
}

export async function listConversations(
  userId: string
): Promise<
  Array<{ id: string; title: string; created_at: string; updated_at: string }>
> {
  const res = await fetch(
    `${supabaseUrl()}/rest/v1/conversations?user_id=eq.${userId}&select=id,title,created_at,updated_at&order=updated_at.desc&limit=50`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const res = await fetch(
    `${supabaseUrl()}/rest/v1/conversations?id=eq.${conversationId}&user_id=eq.${userId}`,
    { method: "DELETE", headers: supabaseHeaders() }
  );
  return res.ok;
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await fetch(
    `${supabaseUrl()}/rest/v1/conversations?id=eq.${conversationId}`,
    {
      method: "PATCH",
      headers: supabaseHeaders(),
      body: JSON.stringify({ title, updated_at: new Date().toISOString() }),
    }
  );
}

export async function touchConversation(
  conversationId: string
): Promise<void> {
  await fetch(
    `${supabaseUrl()}/rest/v1/conversations?id=eq.${conversationId}`,
    {
      method: "PATCH",
      headers: supabaseHeaders(),
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    }
  );
}

/* ── Message CRUD ── */

export async function saveMessage(
  conversationId: string,
  role: string,
  content: string
): Promise<void> {
  await fetch(`${supabaseUrl()}/rest/v1/messages`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      conversation_id: conversationId,
      role,
      content,
    }),
  });
}

export async function getMessages(
  conversationId: string
): Promise<Array<{ id: string; role: string; content: string; created_at: string }>> {
  const res = await fetch(
    `${supabaseUrl()}/rest/v1/messages?conversation_id=eq.${conversationId}&select=id,role,content,created_at&order=created_at.asc&limit=500`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) return [];
  return res.json();
}

/* ── Auth middleware helper ── */

export async function authenticateRequest(
  request: Request
): Promise<{ user?: User; error?: string }> {
  const token = getSessionCookie(request);
  if (!token) return { error: "Not authenticated" };
  const user = await validateSession(token);
  if (!user) return { error: "Session expired" };
  return { user };
}
