const MAX_TRANSCRIPT_CHARS = 12000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const ANDROID_UA = "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip";

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

type CaptionTrack = { languageCode?: string; kind?: string; baseUrl?: string };

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  return (
    tracks.find((t) => t.languageCode === "ko" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === "ko") ||
    tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0]
  );
}

async function fetchTrackText(baseUrl: string): Promise<string | null> {
  const captionUrl = baseUrl.replace(/\\u0026/g, "&");
  const capRes = await fetch(captionUrl, { headers: { "User-Agent": BROWSER_UA } });
  if (!capRes.ok) return null;
  const xml = await capRes.text();
  const lines = Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)).map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim(),
  );
  const text = lines.filter(Boolean).join(" ").slice(0, MAX_TRANSCRIPT_CHARS);
  if (!text || text.length < 20) return null;
  return text;
}

// 1차 시도: 유튜브 안드로이드 앱이 실제로 쓰는 내부 API (innertube).
// 웹페이지를 통째로 긁는 방식보다 서버(클라우드) IP에서 차단당할 확률이 낮음.
async function fetchViaInnertube(
  videoId: string,
): Promise<{ title: string; text: string } | null> {
  console.log("[video-caption] innertube: 요청 시작", { videoId });
  const res = await fetch(
    "https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": ANDROID_UA,
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": "19.09.37",
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 30,
            userAgent: ANDROID_UA,
            hl: "ko",
            gl: "KR",
          },
        },
      }),
    },
  );
  console.log("[video-caption] innertube: 응답 상태", { status: res.status, ok: res.ok });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.log("[video-caption] innertube: 실패 응답 본문", { body: errText.slice(0, 300) });
    return null;
  }

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    console.log("[video-caption] innertube: JSON 파싱 실패", {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }

  const title: string = data?.videoDetails?.title ?? "";
  const tracks: CaptionTrack[] =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  console.log("[video-caption] innertube: 자막 트랙 개수", {
    count: Array.isArray(tracks) ? tracks.length : "not-array",
    playabilityStatus: data?.playabilityStatus?.status,
    reason: data?.playabilityStatus?.reason,
  });
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const pick = pickTrack(tracks);
  if (!pick?.baseUrl) {
    console.log("[video-caption] innertube: baseUrl 없음");
    return null;
  }

  const text = await fetchTrackText(pick.baseUrl);
  console.log("[video-caption] innertube: 자막 텍스트 길이", { length: text?.length ?? 0 });
  if (!text) return null;
  return { title, text };
}

// 2차 시도(폴백): 기존 방식 — 시청 페이지 HTML에서 자막 정보 긁어오기.
async function fetchViaWatchPage(
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
  console.log("[video-caption] watchpage: 응답 상태", { status: pageRes.status, ok: pageRes.ok });
  if (!pageRes.ok) return null;
  const html = await pageRes.text();

  const titleMatch =
    html.match(/"title":"([^"]*)","description"/) || html.match(/<title>([^<]*)<\/title>/);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/ - YouTube$/, "") : "";

  const tracksMatch = html.match(/"captionTracks":(\[.*?\])/);
  console.log("[video-caption] watchpage: captionTracks 매치 여부", {
    found: !!tracksMatch,
    htmlLength: html.length,
  });
  if (!tracksMatch) return null;

  let tracks: CaptionTrack[];
  try {
    tracks = JSON.parse(tracksMatch[1]);
  } catch {
    return null;
  }
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const pick = pickTrack(tracks);
  if (!pick?.baseUrl) return null;

  const text = await fetchTrackText(pick.baseUrl);
  if (!text) return null;
  return { title, text };
}

async function fetchYoutubeTranscript(
  videoId: string,
): Promise<{ title: string; text: string } | null> {
  const viaInnertube = await fetchViaInnertube(videoId).catch(() => null);
  if (viaInnertube) return viaInnertube;
  return fetchViaWatchPage(videoId).catch(() => null);
}

// 3차 시도(최종 폴백): 자막이 아예 없는 영상(요리 쇼츠에 흔함)을 위해
// YouTube Data API v3로 영상 설명(description)란을 가져온다.
// 많은 요리 채널이 자막 대신 설명란에 재료·순서 전문을 적어두기 때문.
async function fetchYoutubeDescriptionViaApi(
  videoId: string,
): Promise<{ title: string; text: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log("[video-caption] youtube-api: YOUTUBE_API_KEY 없음, 건너뜀");
    return null;
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
  const res = await fetch(apiUrl);
  console.log("[video-caption] youtube-api: 응답 상태", { status: res.status, ok: res.ok });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.log("[video-caption] youtube-api: 실패 응답 본문", { body: errText.slice(0, 300) });
    return null;
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const snippet = data?.items?.[0]?.snippet;
  const title: string = snippet?.title ?? "";
  const description: string = snippet?.description ?? "";
  console.log("[video-caption] youtube-api: 설명 길이", { length: description.length });

  if (!description || description.trim().length < 20) return null;
  return { title, text: description.slice(0, MAX_TRANSCRIPT_CHARS) };
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
      const transcript = await fetchYoutubeTranscript(videoId);
      if (transcript && transcript.text) {
        return jsonResponse({
          source: "youtube_transcript",
          title: transcript.title,
          text: transcript.text,
        });
      }

      // 자막이 없으면 영상 설명(description)란으로 재시도
      const viaDescription = await fetchYoutubeDescriptionViaApi(videoId).catch(() => null);
      if (viaDescription && viaDescription.text) {
        return jsonResponse({
          source: "youtube_description",
          title: viaDescription.title,
          text: viaDescription.text,
        });
      }

      return jsonResponse(
        {
          error:
            "이 영상은 자막·설명글을 가져올 수 없었어요. 설명이나 댓글에 적힌 재료·순서 텍스트를 직접 붙여넣어주세요.",
        },
        422,
      );
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
