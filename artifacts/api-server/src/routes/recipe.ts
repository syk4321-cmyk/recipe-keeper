import { Router, type IRouter } from "express";

const router: IRouter = Router();

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

function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== "object") return false;

  const block = value as Record<string, unknown>;
  if (block.type === "text") {
    return typeof block.text === "string" && block.text.trim().length > 0;
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
      imageSource.data.length > 0
    );
  }

  return false;
}

router.post("/recipe/analyze", async (req, res): Promise<void> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    req.log.error("ANTHROPIC_API_KEY is not configured");
    res.status(503).json({ error: "AI 분석 기능이 아직 설정되지 않았어요." });
    return;
  }

  const content = req.body?.content;
  if (
    !Array.isArray(content) ||
    content.length === 0 ||
    content.length > 20 ||
    !content.every(isContentBlock)
  ) {
    req.log.warn("Invalid recipe analysis request");
    res.status(400).json({ error: "분석할 내용이 올바르지 않아요." });
    return;
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

    const responseBody = (await anthropicResponse.json()) as {
      content?: unknown;
      error?: { type?: string; message?: string };
    };

    if (!anthropicResponse.ok) {
      req.log.error(
        { statusCode: anthropicResponse.status, errorType: responseBody.error?.type },
        "Anthropic recipe analysis request failed",
      );
      res.status(502).json({ error: "AI 분석에 실패했어요." });
      return;
    }

    if (!Array.isArray(responseBody.content)) {
      req.log.error("Anthropic returned an invalid recipe analysis response");
      res.status(502).json({ error: "AI 응답을 읽을 수 없어요." });
      return;
    }

    res.json({ content: responseBody.content });
  } catch (error) {
    req.log.error(
      { error: error instanceof Error ? error.message : "unknown error" },
      "Anthropic recipe analysis request errored",
    );
    res.status(502).json({ error: "AI 분석에 실패했어요." });
  }
});

export default router;