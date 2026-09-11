import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'sym.cookmark.app',
  appName: '쿡마크',
  webDir: 'dist/public',

  // 원격 로딩 방식: 네이티브 껍데기 안에서 실제로는 배포된 Netlify 주소를 불러와요.
  // 코드를 고쳐서 Netlify에 배포만 하면, 앱을 다시 빌드하지 않아도 바로 반영돼요.
  server: {
    url: 'https://charming-cassata-060c6f.netlify.app',
    cleartext: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#FBF7F2',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // 네이티브 구글 로그인(WebView 팝업 대신 OS 자체 계정 선택 UI 사용).
    // skipNativeAuth: true로 두면 네이티브 SDK는 구글 로그인 자격 증명(ID 토큰)만
    // 가져오고, 실제 Firebase 로그인 세션은 기존처럼 firebase/auth JS SDK(auth 객체)가
    // 그대로 소유한다 — 웹/앱 두 플랫폼에서 auth 상태 관리 로직을 하나로 유지하기 위함.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
