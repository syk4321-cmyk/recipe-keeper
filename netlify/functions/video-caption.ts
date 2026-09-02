const MAX_TRANSCRIPT_CHARS = 12000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u0026/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function extractYoutubeId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shorts) return shorts[1];
      const embed = u.pathname.match(/^\/embed\/([^/]+)/);
      if (embed) return embed[1];
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchYoutubeTranscript(
  videoId: string,
): Promise<{ title: string; text: string } | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=ko&gl=KR`;
  const pageRes = await fetch(watchUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      Cookie: "CONSENT=YES+1",
    },
  });
  if (!pageRes.ok) return null;
  const html = await pageRes.text();

  const titleMatch =
    html.match(/"title":"([^"]*)","description"/) ||
    html.match(/<title>([^<]*)<\/title>/);
  const title = titleMatch
    ? decodeEntities(titleMatch[1]).replace(/ - YouTube$/, "")
    : "";

  const tracksMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!tracksMatch) return null;

  let tracks: Array<{ languageCode?: string; kind?: string; baseUrl?: string }>;
  try {
    tracks = JSON.parse(tracksMatch[1]);
  } catch {
    return null;
  }
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const pick =
    tracks.find((t) => t.languageCode === "ko" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === "ko") ||
    tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0];

  if (!pick?.baseUrl) return null;

  const captionUrl = pick.baseUrl.replace(/\\u0026/g, "&");
  const capRes = await fetch(captionUrl, { headers: { "User-Agent": BROWSER_UA } });
  if (!capRes.ok) return null;
  const xml = await capRes.text();

  const lines = Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)).map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim(),
  );
  const text = lines.filter(Boolean).join(" ").slice(0, MAX_TRANSCRIPT_CHARS);

  if (!text || text.length < 20) return null;
  return { title, text };
}

async function fetchOgDescription(
  rawUrl: string,
): Promise<{ title: string; text: string } | null> {
  const res = await fetch(rawUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();

  const getMeta = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const m = html.match(re);
    return m ? decodeEntities(m[1]) : "";
  };

  const title = getMeta("og:title");
  const description = getMeta("og:description");
  if (!description || description.trim().length < 20) return null;

  return { title, text: description };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return jsonResponse({ error: "요청 내용을 읽을 수 없어요." }, 400);
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return jsonResponse({ error: "링크가 비어있어요." }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return jsonResponse({ error: "올바른 링크가 아니에요." }, 400);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return jsonResponse({ error: "올바른 링크가 아니에요." }, 400);
  }

  const host = parsedUrl.hostname.replace(/^www\./, "");
  const isYoutube =
    host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
  const isInstagram = host === "instagram.com";

  if (!isYoutube && !isInstagram) {
    return jsonResponse(
      {
        error:
          "지금은 유튜브와 인스타그램 링크만 자동으로 읽어올 수 있어요. 설명·캡션 텍스트를 직접 붙여넣어주세요.",
      },
      422,
    );
  }

  try {
    if (isYoutube) {
      const videoId = extractYoutubeId(rawUrl);
      if (!videoId) {
        return jsonResponse({ error: "유튜브 영상 주소를 인식하지 못했어요." }, 422);
      }
      const result = await fetchYoutubeTranscript(videoId);
      if (!result || !result.text) {
        return jsonResponse(
          {
            error:
              "이 영상은 자막(스크립트)을 가져올 수 없었어요. 설명이나 댓글에 적힌 재료·순서 텍스트를 직접 붙여넣어주세요.",
          },
          422,
        );
      }
      return jsonResponse({
        source: "youtube_transcript",
        title: result.title,
        text: result.text,
      });
    }

    const result = await fetchOgDescription(rawUrl);
    if (!result || !result.text) {
      return jsonResponse(
        {
          error: "이 게시물에서 설명글을 가져오지 못했어요. 캡션 텍스트를 직접 붙여넣어주세요.",
        },
        422,
      );
    }
    return jsonResponse({ source: "og_description", title: result.title, text: result.text });
  } catch (error) {
    console.error("video-caption fetch failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return jsonResponse(
      { error: "영상 정보를 가져오는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." },
      502,
    );
  }
}
