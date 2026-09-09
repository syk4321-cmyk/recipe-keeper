const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// recipe-analyze.ts와 동일한 모델로 맞춤
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 500;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  // "recipe": 특정 레시피 기준으로 답변. "cart": 장바구니에 담긴 재료 전체 기준으로, 범용 요리 도우미처럼 답변.
  contextType?: "recipe" | "cart";
  recipeTitle?: string;
  ingredients?: string[];
  steps?: string[];
  question?: string;
  history?: ChatMessage[];
};

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

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "허용되지 않은 요청입니다." }, 405);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not configured");
    return jsonResponse({ error: "서버 설정 오류입니다." }, 503);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "잘못된 요청 형식입니다." }, 400);
  }

  const { recipeTitle, ingredients, steps, question, history } = body;
  const contextType = body.contextType === "cart" ? "cart" : "recipe";

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return jsonResponse({ error: "질문을 입력해주세요." }, 400);
  }

  if (question.length > 300) {
    return jsonResponse(
      { error: "질문이 너무 깁니다. 300자 이내로 입력해주세요." },
      400,
    );
  }

  // 컨텍스트 종류에 따라 시스템 프롬프트를 분기: 레시피 하나 기준 vs 장바구니 재료 전체 기준
  const systemPrompt =
    contextType === "cart"
      ? `당신은 사용자가 장바구니에 담아둔 재료들을 기준으로 답변하는 범용 요리 도우미입니다.
특정 레시피 하나에 얽매이지 말고, 지금 담긴 재료들을 종합적으로 활용할 수 있는 방향으로 실용적이고 구체적으로 답변하세요.
재료와 무관한 질문에는 이 재료들과 관련된 방향으로 자연스럽게 안내하세요.
답변은 존댓말로, 2~4문장 이내로 간결하게 작성하세요.

[지금 장바구니에 담긴 재료]
${(ingredients || []).join(", ") || "담긴 재료가 없어요"}`
      : `당신은 사용자가 저장한 레시피에 대해 질문에 답하는 요리 도우미입니다.
아래 레시피 정보를 기준으로, 실용적이고 구체적으로 답변하세요.
레시피와 무관한 질문에는 이 레시피와 관련된 방향으로 자연스럽게 안내하세요.
답변은 존댓말로, 2~4문장 이내로 간결하게 작성하세요.

[레시피 정보]
제목: ${recipeTitle || "제목 없음"}
재료: ${(ingredients || []).join(", ") || "정보 없음"}
조리 순서: ${(steps || []).map((s, i) => `${i + 1}. ${s}`).join(" ") || "정보 없음"}`;

  // 같은 채팅 세션 내 이전 대화(최근 10개까지)를 함께 전달 — DB 저장은 하지 않고 프론트에서만 들고 있음
  const messages = [
    ...(history || []).slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: question },
  ];

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
        system: systemPrompt,
        messages,
      }),
    });

    const responseBody = (await anthropicResponse.json()) as AnthropicResponse;

    if (!anthropicResponse.ok) {
      console.error("Anthropic recipe chat request failed", {
        statusCode: anthropicResponse.status,
        errorType: responseBody.error?.type,
      });
      return jsonResponse(
        { error: "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요." },
        502,
      );
    }

    if (!Array.isArray(responseBody.content)) {
      console.error("Anthropic returned an invalid recipe chat response");
      return jsonResponse({ error: "AI 응답을 읽을 수 없어요." }, 502);
    }

    const answer =
      (responseBody.content as Array<{ type: string; text?: string }>).find(
        (block) => block.type === "text",
      )?.text || "";

    return jsonResponse({ answer });
  } catch (error) {
    console.error("Anthropic recipe chat request errored", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return jsonResponse({ error: "서버 오류가 발생했습니다." }, 502);
  }
}
