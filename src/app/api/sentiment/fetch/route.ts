import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { authenticateAdmin } from "@/lib/auth";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

const TARGET_SUBS = ["naturalgas", "energy", "commodities", "natgas", "oil"];

interface RedditPost {
  reddit_id: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  post_type: "post" | "comment";
  score: number;
  num_comments: number;
  permalink: string;
  posted_at: string;
}

interface SentimentResult {
  index: number;
  sentiment_score: number;
  sentiment_label: "bullish" | "bearish" | "neutral";
  keywords: string[];
}

/* ── Reddit OAuth2 token (application-only / client credentials) ── */

let redditToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  if (redditToken && Date.now() < redditToken.expiresAt) {
    return redditToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "HENRYHUB.ai/1.0",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reddit auth failed: ${res.status} — ${text}`);
  }

  const data = await res.json();
  redditToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return redditToken.token;
}

/* ── Fetch posts from Reddit OAuth API ── */

async function fetchSubreddit(
  sub: string,
  token: string
): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];

  try {
    const res = await fetch(
      `https://oauth.reddit.com/r/${sub}/new?limit=25`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "HENRYHUB.ai/1.0",
        },
      }
    );
    if (!res.ok) return posts;

    const json = await res.json();
    const children = json?.data?.children || [];

    for (const child of children) {
      const d = child.data;
      if (!d || d.removed_by_category) continue;

      // Filter for natural gas relevance
      const text = `${d.title} ${d.selftext || ""}`.toLowerCase();
      const isRelevant =
        sub === "naturalgas" ||
        sub === "natgas" ||
        text.includes("natural gas") ||
        text.includes("nat gas") ||
        text.includes("henry hub") ||
        text.includes("nymex gas") ||
        text.includes("lng") ||
        text.includes("ng futures") ||
        text.includes("gas storage") ||
        text.includes("gas prices") ||
        text.includes("gas demand") ||
        text.includes("gas production") ||
        text.includes("gas exports");

      if (!isRelevant) continue;

      posts.push({
        reddit_id: d.name || `t3_${d.id}`,
        subreddit: sub,
        title: (d.title || "").slice(0, 500),
        body: (d.selftext || "").slice(0, 5000),
        author: d.author || "[deleted]",
        post_type: "post",
        score: d.score || 0,
        num_comments: d.num_comments || 0,
        permalink: d.permalink
          ? `https://www.reddit.com${d.permalink}`
          : "",
        posted_at: new Date((d.created_utc || 0) * 1000).toISOString(),
      });
    }
  } catch {
    // Skip failed subreddits silently
  }

  return posts;
}

/* ── Sentiment analysis via Anthropic ── */

async function analyzeBatch(
  posts: RedditPost[],
  apiKey: string
): Promise<SentimentResult[]> {
  const items = posts.map((p, i) => ({
    index: i,
    title: p.title,
    body: p.body.slice(0, 500),
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Analyze these Reddit posts about natural gas markets. For each, return:
- sentiment_score: float from -1.0 (extremely bearish) to +1.0 (extremely bullish). 0 is neutral.
- sentiment_label: "bullish", "bearish", or "neutral"
- keywords: array of 3-5 relevant market keywords (e.g., "storage", "LNG", "winter demand")

Return ONLY a JSON array matching the input indices. No markdown, no explanation.

Posts:
${JSON.stringify(items)}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const json = await res.json();
  const text = json.content?.[0]?.text || "[]";
  return JSON.parse(text);
}

/* ── Main handler ── */

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "sentiment-fetch", RATE_LIMITS.AUTH);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const auth = await authenticateAdmin(request);
  if (auth.error || !auth.user) {
    const status = auth.error === "Forbidden" ? 403 : 401;
    return errorResponse(auth.error || "Forbidden", status);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const redditClientId = process.env.REDDIT_CLIENT_ID;
  const redditClientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return errorResponse("Server misconfigured", 500);
  }
  if (!redditClientId || !redditClientSecret) {
    return errorResponse(
      "Reddit API credentials not configured. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to environment variables.",
      500
    );
  }

  // 0. Get Reddit OAuth token
  let token: string;
  try {
    token = await getRedditToken(redditClientId, redditClientSecret);
  } catch (err) {
    return errorResponse(
      `Reddit auth failed: ${err instanceof Error ? err.message : "Unknown"}`,
      502
    );
  }

  // 1. Fetch from all subreddits
  const allPosts: RedditPost[] = [];
  for (const sub of TARGET_SUBS) {
    const posts = await fetchSubreddit(sub, token);
    allPosts.push(...posts);
    // Small delay to respect Reddit rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  if (allPosts.length === 0) {
    return jsonResponse({
      fetched: 0,
      inserted: 0,
      message: "No relevant posts found across subreddits",
    });
  }

  // 2. Check which posts already exist
  const ids = allPosts.map((p) => p.reddit_id);
  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/reddit_posts?reddit_id=in.(${ids.map(encodeURIComponent).join(",")})&select=reddit_id`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const existingIds = new Set(
    existingRes.ok
      ? (await existingRes.json()).map(
          (r: { reddit_id: string }) => r.reddit_id
        )
      : []
  );

  const newPosts = allPosts.filter((p) => !existingIds.has(p.reddit_id));
  if (newPosts.length === 0) {
    return jsonResponse({
      fetched: allPosts.length,
      inserted: 0,
      message: "All posts already ingested",
    });
  }

  // 3. Analyze sentiment in batches of 10
  const BATCH = 10;
  let inserted = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (let i = 0; i < newPosts.length; i += BATCH) {
    const batch = newPosts.slice(i, i + BATCH);

    let results: SentimentResult[];
    try {
      results = await analyzeBatch(batch, anthropicKey);
    } catch (err) {
      return jsonResponse({
        fetched: allPosts.length,
        inserted,
        error: `Analysis failed at batch ${Math.floor(i / BATCH) + 1}: ${err instanceof Error ? err.message : "Unknown"}`,
      });
    }

    const rows = batch.map((post, idx) => {
      const analysis = results.find((r) => r.index === idx) || {
        sentiment_score: 0,
        sentiment_label: "neutral" as const,
        keywords: [],
      };

      const dateStr = post.posted_at.split("T")[0];
      if (!minDate || dateStr < minDate) minDate = dateStr;
      if (!maxDate || dateStr > maxDate) maxDate = dateStr;

      return {
        reddit_id: post.reddit_id,
        subreddit: post.subreddit,
        title: post.title,
        body: post.body,
        author: post.author,
        post_type: post.post_type,
        score: post.score,
        num_comments: post.num_comments,
        permalink: post.permalink,
        sentiment_score: Math.max(-1, Math.min(1, analysis.sentiment_score)),
        sentiment_label: analysis.sentiment_label,
        keywords: `{${analysis.keywords.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}}`,
        posted_at: post.posted_at,
      };
    });

    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/reddit_posts`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });

    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      return jsonResponse({
        fetched: allPosts.length,
        inserted,
        error: `DB insert failed: ${text}`,
      });
    }

    inserted += rows.length;
  }

  // 4. Rebuild snapshots
  let snapshotsOk = false;
  if (minDate && maxDate) {
    const rebuildRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/rebuild_sentiment_snapshots`,
      {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_start_date: minDate, p_end_date: maxDate }),
      }
    );
    snapshotsOk = rebuildRes.ok;
  }

  return jsonResponse({
    fetched: allPosts.length,
    new: newPosts.length,
    inserted,
    snapshots_rebuilt: snapshotsOk,
    date_range: { from: minDate, to: maxDate },
  });
}
