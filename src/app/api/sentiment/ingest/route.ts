import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { authenticateAdmin } from "@/lib/auth";
import { rateLimitResponse, errorResponse, jsonResponse } from "@/lib/validate";

interface PostInput {
  reddit_id: string;
  subreddit: string;
  title: string;
  body?: string;
  author?: string;
  post_type?: "post" | "comment";
  score?: number;
  num_comments?: number;
  permalink?: string;
  posted_at: string;
}

interface SentimentResult {
  index: number;
  sentiment_score: number;
  sentiment_label: "bullish" | "bearish" | "neutral";
  keywords: string[];
}

async function analyzeSentiment(
  posts: PostInput[],
  apiKey: string
): Promise<SentimentResult[]> {
  const items = posts.map((p, i) => ({
    index: i,
    title: p.title,
    body: (p.body || "").slice(0, 500),
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

Return ONLY a JSON array, no markdown or explanation.

Posts:
${JSON.stringify(items)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status}`);
  }

  const json = await res.json();
  const text = json.content?.[0]?.text || "[]";
  return JSON.parse(text);
}

function supabaseHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "sentiment-ingest", RATE_LIMITS.AUTH);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const auth = await authenticateAdmin(request);
  if (auth.error || !auth.user) {
    const status = auth.error === "Forbidden" ? 403 : 401;
    return errorResponse(auth.error || "Forbidden", status);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return errorResponse("Server misconfigured", 500);
  }

  let body: { posts?: PostInput[]; rebuild_snapshots?: boolean };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const posts = body.posts;
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return errorResponse("posts array is required");
  }
  if (posts.length > 100) {
    return errorResponse("Maximum 100 posts per request");
  }

  // Process in batches of 10
  const BATCH_SIZE = 10;
  let inserted = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    // Analyze sentiment via Anthropic
    let results: SentimentResult[];
    try {
      results = await analyzeSentiment(batch, anthropicKey);
    } catch (err) {
      return errorResponse(
        `Sentiment analysis failed at batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : "Unknown error"}`,
        502
      );
    }

    // Merge analysis results with post data
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
        subreddit: post.subreddit.toLowerCase().replace(/^r\//, ""),
        title: post.title.slice(0, 500),
        body: (post.body || "").slice(0, 5000),
        author: post.author || null,
        post_type: post.post_type || "post",
        score: post.score || 0,
        num_comments: post.num_comments || 0,
        permalink: post.permalink || null,
        sentiment_score: Math.max(-1, Math.min(1, analysis.sentiment_score)),
        sentiment_label: analysis.sentiment_label,
        keywords: `{${analysis.keywords.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}}`,
        posted_at: post.posted_at,
      };
    });

    // Upsert into reddit_posts
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/reddit_posts`, {
      method: "POST",
      headers: supabaseHeaders(supabaseKey),
      body: JSON.stringify(rows),
    });

    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      return errorResponse(`Database upsert failed: ${text}`, 500);
    }

    inserted += rows.length;
  }

  // Rebuild snapshots for affected date range
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
        body: JSON.stringify({
          p_start_date: minDate,
          p_end_date: maxDate,
        }),
      }
    );

    if (!rebuildRes.ok) {
      return jsonResponse({
        inserted,
        snapshots_rebuilt: false,
        warning: "Posts inserted but snapshot rebuild failed",
      });
    }
  }

  return jsonResponse({
    inserted,
    snapshots_rebuilt: true,
    date_range: { from: minDate, to: maxDate },
  });
}
