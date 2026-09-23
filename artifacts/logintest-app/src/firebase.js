// firebase.js — 구글 로그인 재현 실험 전용 최소 테스트 앱
// 새 Firebase 프로젝트(cookmark-logintest)의 설정값.
// 이 앱은 배포/유지 목적이 아니라 진단 실험용이라 환경변수 없이 값을 직접 박아둠.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDo07ioeI22_mf2siO0Z7ozrinhfzDM6i8",
  authDomain: "cookmark-logintest.firebaseapp.com",
  projectId: "cookmark-logintest",
  storageBucket: "cookmark-logintest.firebasestorage.app",
  messagingSenderId: "152969037862",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;
