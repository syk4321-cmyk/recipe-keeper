// firebase.js
// Cookmark 앱의 Firebase 연결 설정 파일입니다.
// 이 파일은 앱 어디서든 auth(로그인)와 db(데이터베이스)를 가져다 쓸 수 있게 해줍니다.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > cookmark-web 에서 확인한 값입니다.
const firebaseConfig = {
  apiKey: "AIzaSyCChmKg56egvso3PCQqY28ZgeRo9YXq0x0",
  authDomain: "cookmark-3c4f3.firebaseapp.com",
  projectId: "cookmark-3c4f3",
  storageBucket: "cookmark-3c4f3.firebasestorage.app",
  messagingSenderId: "101834924948",
  appId: "1:101834924948:web:94dd959825222712912581",
  measurementId: "G-74EL20QVF2",
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 로그인 기능(Authentication)
export const auth = getAuth(app);

// 데이터베이스(Firestore)
export const db = getFirestore(app);

export default app;
