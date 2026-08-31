const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;

type TextBlock = {
  type: "text";
  text: string;
};

type ImageBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
};

type ContentBlock = TextBlock | ImageBlock;

type AnthropicResponse = {
  content?: unknown;
  error?: {
    type?: string;
    message?: string;
  };
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== "object") return false;

  const block = value as Record<string, unknown>;
  if (block.type === "text") {
    return (
      typeof block.text === "string" &&
      block.text.trim().length > 0 &&
      block.text.length <= 200_000
    );
  }

  if (block.type === "image") {
    const source = block.source;
    if (!source || typeof source !== "object") return false;

    const imageSource = source as Record<string, unknown>;
    return (
      imageSource.type === "base64" &&
      typeof imageSource.media_type === "string" &&
      /^image\/(jpeg|png|gif|webp)$/i.test(imageSource.media_type) &&
      typeof imageSource.data === "string" &&
      imageSource.data.length > 0 &&
      imageSource.data.length <= 8_000_000
    );
  }

  return false;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not configured");
    return jsonResponse(
      { error: "AI 분석 기능이 아직 설정되지 않았어요." },
      503,
    );
  }

  let body: { content?: unknown };
  try {
    body = (await request.json()) as { content?: unknown };
  } catch {
    return jsonResponse({ error: "요청 내용을 읽을 수 없어요." }, 400);
  }

  const content = body.content;
  if (
    !Array.isArray(content) ||
    content.length === 0 ||
    content.length > 20 ||
    !content.every(isContentBlock)
  ) {
    return jsonResponse({ error: "분석할 내용이 올바르지 않아요." }, 400);
  }

  try {
    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content }],
      }),
    });

    const responseBody = (await anthropicResponse.json()) as AnthropicResponse;

    if (!anthropicResponse.ok) {
      console.error("Anthropic recipe analysis request failed", {
        statusCode: anthropicResponse.status,
        errorType: responseBody.error?.type,
      });
      return jsonResponse({ error: "AI 분석에 실패했어요." }, 502);
    }

    if (!Array.isArray(responseBody.content)) {
      console.error("Anthropic returned an invalid recipe analysis response");
      return jsonResponse({ error: "AI 응답을 읽을 수 없어요." }, 502);
    }

    return jsonResponse({ content: responseBody.content });
  } catch (error) {
    console.error("Anthropic recipe analysis request errored", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return jsonResponse({ error: "AI 분석에 실패했어요." }, 502);
  }
}