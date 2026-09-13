import React, { useState } from 'react';
import {
  signInWithPopup,
  signInWithCredential,
  signInAnonymously,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth } from './firebase';

// 쿡마크 로고 (흰 배경 버전, base64)
const COOKMARK_LOGO =
  'data:image/png;base64,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';

export default function LoginScreen() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInAnonymously(auth);
    } catch (err) {
      setError(mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);

      if (Capacitor.isNativePlatform()) {
        const { credential } = await FirebaseAuthentication.signInWithGoogle({
          useCredentialManager: false,
        });
        if (!credential?.idToken) {
          throw new Error('구글 로그인 토큰을 가져오지 못했어요.');
        }
        const authCredential = GoogleAuthProvider.credential(credential.idToken);
        await signInWithCredential(auth, authCredential);
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      if (isUserCancelledGoogleLogin(err)) {
        // 사용자가 계정 선택을 취소한 경우
      } else {
        alert(
          `[DEBUG] Google 로그인 실패\ncode: ${err?.code}\nmessage: ${err?.message}\n${JSON.stringify(err)}`
        );
        setError(mapAuthError(err.code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Gowun Dodum', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <img src={COOKMARK_LOGO} alt="Cookmark 로고" style={{ width: 88, height: 88, marginBottom: 12 }} />
          <div style={{ fontSize: 32, fontWeight: 700, color: '#6B3F5C', letterSpacing: '-0.5px' }}>Cookmark</div>
          <div style={{ fontSize: 14, color: '#8A7A6D', marginTop: 6 }}>흩어진 레시피를 한곳에</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && (<div style={{ fontSize: 13, color: '#C0392B', textAlign: 'center' }}>{error}</div>)}
          <button onClick={handleGoogleLogin} disabled={loading} style={{ height: 46, borderRadius: 12, background: '#FFFDF9', border: '1px solid #E3D8C8', color: '#4A2B40', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: loading ? 'default' : 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.5 6.6-16.5z" />
              <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.3 46 24 46z" />
              <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z" />
              <path fill="#EA4335" d="M24 10.9c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.2 30 2 24 2 15.3 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9 12.4-9z" />
            </svg>
            Google로 계속하기
          </button>
          <button onClick={handleGuestLogin} disabled={loading} style={{ height: 40, background: 'transparent', border: 'none', color: '#8A7A6D', fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer' }}>
            게스트로 시작하기
          </button>
          <div style={{ fontSize: 12, color: '#A79A8C', textAlign: 'center', marginTop: -8, lineHeight: 1.5 }}>
            게스트로 시작하면 이 기기에만 데이터가 저장돼요.
            <br />
            삭제/재설치 시 복구되지 않아요.
          </div>
        </div>
      </div>
    </div>
  );
}

function isUserCancelledGoogleLogin(err) {
  if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
    return true;
  }
  return /cancel/i.test(String(err?.message || ''));
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google 로그인 창이 닫혔어요. 다시 시도해주세요.';
    default:
      return '오류가 발생했어요. 다시 시도해주세요.';
  }
}
