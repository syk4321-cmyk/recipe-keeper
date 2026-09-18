// firebase.js
// Cookmark 앱의 Firebase 연결 설정 파일입니다.
// 이 파일은 앱 어디서든 auth(로그인)와 db(데이터베이스)를 가져다 쓸 수 있게 해줍니다.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > cookmark-web 에서 확인한 값입니다.
// 클라이언트에 그대로 노출되는 게 Firebase 설계상 정상이라 값 자체는 비밀이 아니지만,
// Netlify의 시크릿 스캐너가 빌드 결과물에 박힌 API 키 형태 문자열을 오탐하므로
// 환경변수로 빼고(.env, netlify.toml) SECRETS_SCAN_OMIT_KEYS로 예외 처리했습니다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 로그인 기능(Authentication)
export const auth = getAuth(app);

// 데이터베이스(Firestore) — 기기에 오프라인 캐시를 켜서, 앱을 껐다 켠 직후
// 네트워크가 아직 안 붙은 상태에서도 로컬에 저장된 데이터를 먼저 읽을 수 있게 함
// (콜드 스타트 직후 읽기 실패로 빈 상태가 서버에 덮어써지는 문제 방지)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});

export default app;
