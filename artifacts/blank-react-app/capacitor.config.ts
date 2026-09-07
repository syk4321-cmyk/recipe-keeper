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
  },
};

export default config;
