import * as admin from "firebase-admin";

const KAKAO_USER_ME_URL = "https://kapi.kakao.com/v2/user/me";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function getFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not configured");
  }

  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

type KakaoUserMeResponse = {
  id?: number;
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not configured");
    return jsonResponse(
      { error: "카카오 로그인 기능이 아직 설정되지 않았어요." },
      503,
    );
  }

  let body: { accessToken?: unknown };
  try {
    body = (await request.json()) as { accessToken?: unknown };
  } catch {
    return jsonResponse({ error: "요청 내용을 읽을 수 없어요." }, 400);
  }

  const accessToken = body.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return jsonResponse({ error: "카카오 액세스 토큰이 없어요." }, 400);
  }

  let kakaoUser: KakaoUserMeResponse;
  try {
    const kakaoResponse = await fetch(KAKAO_USER_ME_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!kakaoResponse.ok) {
      console.error("Kakao user info request failed", {
        statusCode: kakaoResponse.status,
      });
      return jsonResponse({ error: "카카오 인증 확인에 실패했어요." }, 401);
    }

    kakaoUser = (await kakaoResponse.json()) as KakaoUserMeResponse;
  } catch (error) {
    console.error("Kakao user info request errored", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return jsonResponse({ error: "카카오 인증 확인에 실패했어요." }, 502);
  }

  if (typeof kakaoUser.id !== "number") {
    return jsonResponse(
      { error: "카카오 사용자 정보를 확인할 수 없어요." },
      401,
    );
  }

  const uid = `kakao_${kakaoUser.id}`;
  const nickname = kakaoUser.kakao_account?.profile?.nickname;
  const profileImageUrl = kakaoUser.kakao_account?.profile?.profile_image_url;

  try {
    getFirebaseAdmin();
    const auth = admin.auth();

    const profileFields = {
      ...(nickname ? { displayName: nickname } : {}),
      ...(profileImageUrl ? { photoURL: profileImageUrl } : {}),
    };

    try {
      await auth.updateUser(uid, profileFields);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/user-not-found") {
        await auth.createUser({ uid, ...profileFields });
      } else {
        throw error;
      }
    }

    const customToken = await auth.createCustomToken(uid, {
      provider: "kakao",
    });

    return jsonResponse({ customToken });
  } catch (error) {
    console.error("Firebase custom token issuance failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return jsonResponse({ error: "로그인 처리에 실패했어요." }, 502);
  }
}
