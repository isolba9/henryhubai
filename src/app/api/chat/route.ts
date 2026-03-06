import { NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateModel,
  sanitizeString,
  rateLimitResponse,
  errorResponse,
  jsonResponse,
} from "@/lib/validate";
import {
  authenticateRequest,
  createConversation,
  saveMessage,
  getMessages,
  touchConversation,
  listConversations,
} from "@/lib/auth";

const SYSTEM_PROMPT = `You are Henry Hub Terminal, an AI assistant specializing in Henry Hub natural gas data. Your expertise covers:

1. Current and historical Henry Hub natural gas prices
2. Supply and demand fundamentals for US natural gas

You have access to tools to query the price database. When a user asks to download data, use the query_price_data tool with the specified date range, then indicate the data is ready for download. When asked for analysis, use the tool to retrieve data, then provide detailed analysis.

Keep responses focused on natural gas markets. Use precise numbers. Format monetary values in USD/MMBtu. Be concise and data-driven, like a Bloomberg terminal analyst.`;

const TOOLS = [
  {
    name: "query_price_data",
    description:
      "Query historical Henry Hub natural gas price data from the database. Returns price records with timestamps. Use when the user asks to download data, view historical prices, or perform analysis on price data.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start date in ISO 8601 format (e.g., 2024-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date in ISO 8601 format (e.g., 2024-12-31)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
];

async function querySupabase(startDate: string, endDate: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Database not configured");

  const url = `${supabaseUrl}/rest/v1/price_history?timestamp=gte.${startDate}&timestamp=lte.${endDate}&order=timestamp.asc&limit=10000`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Supabase query failed: ${res.status}`);
  return res.json();
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, string>;
}

interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: string;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "chat", RATE_LIMITS.AUTH);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return errorResponse("Server misconfigured: missing Anthropic key", 500);

  // Authenticate user
  const auth = await authenticateRequest(request);
  if (auth.error || !auth.user) {
    return errorResponse(auth.error || "Not authenticated", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const model = validateModel(body.model);
  const userMessage = sanitizeString(body.message, 10000);
  if (!userMessage) return errorResponse("Message is required");

  let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;

  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  try {
    // Create conversation if new
    if (!conversationId) {
      const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? "..." : "");
      conversationId = await createConversation(auth.user.id, title);
      if (!conversationId) {
        return errorResponse("Failed to create conversation", 500);
      }
    }

    // Save user message to DB
    await saveMessage(conversationId, "user", userMessage);

    // Fetch full conversation history from DB
    const dbMessages = await getMessages(conversationId);

    // Build messages array for Claude
    const claudeMessages = dbMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    // Enhance system prompt with recent conversation topics for memory
    let systemPrompt = SYSTEM_PROMPT;
    try {
      const recentConvos = await listConversations(auth.user.id);
      const otherConvos = recentConvos
        .filter((c) => c.id !== conversationId)
        .slice(0, 5);
      if (otherConvos.length > 0) {
        const topics = otherConvos
          .map((c) => `- "${c.title}" (${new Date(c.updated_at).toLocaleDateString()})`)
          .join("\n");
        systemPrompt += `\n\nUser's recent conversation topics (for context awareness):\n${topics}`;
      }
    } catch {
      /* context enhancement is optional */
    }

    let downloadData: Record<string, unknown>[] | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    let currentMessages = [...claudeMessages];

    while (attempts < maxAttempts) {
      attempts++;

      const anthropicBody: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: currentMessages,
      };

      if (hasSupabase) {
        anthropicBody.tools = TOOLS;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(anthropicBody),
      });

      if (!res.ok) {
        return errorResponse(`AI service error: ${res.status}`, res.status);
      }

      const data: AnthropicResponse = await res.json();

      if (data.stop_reason === "tool_use") {
        const toolUse = data.content.find((c: ContentBlock) => c.type === "tool_use");
        if (!toolUse || !toolUse.id || !toolUse.input) break;

        if (toolUse.name === "query_price_data" && hasSupabase) {
          try {
            const startDate = sanitizeString(toolUse.input.start_date, 30);
            const endDate = sanitizeString(toolUse.input.end_date, 30);
            const results = await querySupabase(startDate, endDate);

            downloadData = results;

            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: data.content as unknown as string },
              {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: JSON.stringify({
                      record_count: results.length,
                      date_range: { start: startDate, end: endDate },
                      sample: results.length > 0 ? results.slice(0, 5) : [],
                      summary:
                        results.length > 0
                          ? {
                              earliest: results[0]?.timestamp,
                              latest: results[results.length - 1]?.timestamp,
                              min_price: Math.min(
                                ...results.map((r: Record<string, unknown>) => Number(r.price) || 0)
                              ),
                              max_price: Math.max(
                                ...results.map((r: Record<string, unknown>) => Number(r.price) || 0)
                              ),
                              avg_price:
                                Math.round(
                                  (results.reduce(
                                    (sum: number, r: Record<string, unknown>) => sum + (Number(r.price) || 0),
                                    0
                                  ) /
                                    results.length) *
                                    1000
                                ) / 1000,
                            }
                          : null,
                    }),
                  },
                ] as unknown as string,
              },
            ];
            continue;
          } catch (err) {
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: data.content as unknown as string },
              {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: `Error querying database: ${err instanceof Error ? err.message : "Unknown error"}`,
                    is_error: true,
                  },
                ] as unknown as string,
              },
            ];
            continue;
          }
        }
        break;
      }

      const textContent = data.content
        .filter((c: ContentBlock) => c.type === "text")
        .map((c: ContentBlock) => c.text || "")
        .join("\n");

      // Save assistant response to DB
      await saveMessage(conversationId, "assistant", textContent);
      await touchConversation(conversationId);

      return jsonResponse({ content: textContent, model, downloadData, conversationId });
    }

    return errorResponse("Max tool use attempts reached", 500);
  } catch (err) {
    return errorResponse(
      `Chat error: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
