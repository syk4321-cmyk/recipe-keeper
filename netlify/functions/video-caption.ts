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
  console.log("[video-caption] youtube-api: 응답 상세", {
    itemsCount: Array.isArray(data?.items) ? data.items.length : "not-array",
    title,
    titleLength: title.length,
    descriptionLength: description.length,
  });

  // 쇼츠는 설명란 없이 제목에 레시피를 다 적는 경우가 많음.
  // 단, 짧은 마케팅용 제목("~레시피!")은 재료·순서가 없어 쓸모없으므로
  // 어느 정도 길어서 실제 내용이 있을 때만(60자 이상) 제목으로 대체한다.
  // 그보다 짧으면 이 단계 전체를 실패로 처리해 댓글 폴백으로 넘어가게 한다.
  let text = "";
  // 진짜 레시피(재료·순서)가 담기려면 최소 이 정도 분량은 필요함.
  // 너무 낮게 잡으면 "오늘은 ○○ 먹을거에요" 같은 짧은 문구도 통과해버려서
  // 다음 단계(댓글 찾기)로 못 넘어가는 문제가 생김.
  const MIN_USABLE_LENGTH = 60;
  if (description.trim().length >= MIN_USABLE_LENGTH) {
    text = description;
  } else if (title.trim().length >= MIN_USABLE_LENGTH) {
    text = title;
  }
  if (!text) return null;
  return { title, text: text.slice(0, MAX_TRANSCRIPT_CHARS) };
}

// 4차 시도(마지막 폴백): 요리 쇼츠는 설명·제목 없이 "댓글"에 레시피 전문을
// 적어두는 경우가 흔함 (특히 채널 운영자가 직접 단 첫 댓글). 관련성순 상위
// 댓글 중 가장 레시피처럼 긴 텍스트를 골라온다.
async function fetchYoutubeTopComment(videoId: string): Promise<{ text: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=10&key=${apiKey}`;
  const res = await fetch(apiUrl);
  console.log("[video-caption] youtube-comments: 응답 상태", { status: res.status, ok: res.ok });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.log("[video-caption] youtube-comments: 실패 응답 본문", { body: errText.slice(0, 300) });
    return null;
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const texts: string[] = items
    .map((item) => item?.snippet?.topLevelComment?.snippet?.textOriginal ?? "")
    .filter(Boolean);
  console.log("[video-caption] youtube-comments: 댓글 개수·최대 길이", {
    count: texts.length,
    maxLength: texts.reduce((max, t) => Math.max(max, t.length), 0),
  });

  // 레시피처럼 보일 만큼 긴 댓글(재료·순서를 적으려면 최소 이 정도는 됨) 중 가장 긴 것을 선택.
  const candidate = texts
    .filter((t) => t.trim().length >= 80)
    .sort((a, b) => b.length - a.length)[0];
  if (!candidate) return null;
  return { text: candidate.slice(0, MAX_TRANSCRIPT_CHARS) };
}

// 플랜 B: OG 메타태그 파싱(플랜 A)이 실패하면(인스타그램이 서버 IP를 로그인
// 요구 화면으로 돌리는 경우가 흔함) Apify의 Instagram Scraper로 재시도한다.
// run-sync-get-dataset-items 엔드포인트는 스크레이핑이 끝날 때까지 기다렸다가
// 결과를 바로 반환해준다. Netlify 함수 자체 실행시간 제한이 있어서, 너무 오래
// 걸리면 AbortController로 중단하고 실패 처리한다(그다음은 "직접 붙여넣기" 안내).
async function fetchInstagramViaApify(
  rawUrl: string,
): Promise<{ title: string; text: string } | null> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    console.log("[video-caption] apify: APIFY_TOKEN 없음, 건너뜀");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const apiUrl = `https://api.apify.com/v2/acts/apidojo~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
    // 공유 링크에 붙는 추적 파라미터(?igsh=...)가 있으면 Actor가 URL을
    // 못 알아보고 "noResults"를 반환하는 경우가 있어 제거하고 보낸다.
    const cleanUrl = rawUrl.split("?")[0];
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [cleanUrl],
        maxItems: 1,
      }),
      signal: controller.signal,
    });
    console.log("[video-caption] apify: 응답 상태", { status: res.status, ok: res.ok });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.log("[video-caption] apify: 실패 응답 본문", { body: errText.slice(0, 300) });
      return null;
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      return null;
    }

    const items: any[] = Array.isArray(data) ? data : [];
    console.log("[video-caption] apify: 원본 아이템 요약", {
      count: items.length,
      firstItemKeys: items[0] ? Object.keys(items[0]) : [],
      firstItemSample: items[0] ? JSON.stringify(items[0]).slice(0, 500) : null,
    });

    // Actor마다 캡션 필드명이 조금씩 다르고, 결과 배열에 게시물 외 다른
    // 항목(댓글 등)이 섞여 올 수도 있어 모든 항목을 훑어 가장 긴 후보를 채택.
    const candidates: string[] = items
      .map(
        (it) =>
          it?.caption ??
          it?.text ??
          it?.edge_media_to_caption?.edges?.[0]?.node?.text ??
          "",
      )
      .filter((c) => typeof c === "string" && c.trim().length >= 15);
    const caption = candidates.sort((a, b) => b.length - a.length)[0] ?? "";
    console.log("[video-caption] apify: 캡션 길이", {
      candidatesCount: candidates.length,
      captionLength: caption.length,
    });

    if (!caption) return null;
    return { title: "", text: caption.slice(0, MAX_TRANSCRIPT_CHARS) };
  } catch (error) {
    console.log("[video-caption] apify: 예외 발생", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
        // text가 제목과 동일하다는 건 설명이 비어서 제목으로 대체한 경우 →
        // title을 따로 또 보내면 프론트에서 "제목: X\n\nX"로 중복 표시되니 생략.
        const isTitleFallback = viaDescription.text === viaDescription.title;
        return jsonResponse({
          source: "youtube_description",
          title: isTitleFallback ? "" : viaDescription.title,
          text: viaDescription.text,
        });
      }

      // 그마저도 없으면 댓글(특히 채널 운영자가 남긴 레시피 댓글)로 최종 재시도
      const viaComment = await fetchYoutubeTopComment(videoId).catch(() => null);
      if (viaComment && viaComment.text) {
        return jsonResponse({
          source: "youtube_comment",
          title: "",
          text: viaComment.text,
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
    if (result && result.text) {
      return jsonResponse({ source: "og_description", title: result.title, text: result.text });
    }

    // 플랜 A(무료 파싱) 실패 시 플랜 B(Apify 스크레이퍼)로 재시도
    const viaApify = await fetchInstagramViaApify(rawUrl).catch(() => null);
    if (viaApify && viaApify.text) {
      return jsonResponse({ source: "apify_caption", title: viaApify.title, text: viaApify.text });
    }

    return jsonResponse(
      {
        error: "이 게시물에서 설명글을 가져오지 못했어요. 캡션 텍스트를 직접 붙여넣어주세요.",
      },
      422,
    );
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
