import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from './firebase';

// 쿡마크 로고 (흰 배경 버전, base64)
const COOKMARK_LOGO =
  'data:image/png;base64,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';

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.');
      return;
    }

    setLoading(true);
    try {
      await setPersistence(
        auth,
        autoLogin ? browserLocalPersistence : browserSessionPersistence
      );

      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
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
      await setPersistence(
        auth,
        autoLogin ? browserLocalPersistence : browserSessionPersistence
      );
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    if (!email) {
      setError('비밀번호를 재설정할 이메일을 먼저 입력해주세요.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('비밀번호 재설정 링크를 이메일로 보냈어요. 메일함을 확인해주세요.');
    } catch (err) {
      setError(mapAuthError(err.code));
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5EFE6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Gowun Dodum', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* 로고 & 타이틀 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <img
            src={COOKMARK_LOGO}
            alt="Cookmark 로고"
            style={{ width: 88, height: 88, marginBottom: 12 }}
          />
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#6B3F5C',
              letterSpacing: '-0.5px',
            }}
          >
            Cookmark
          </div>
          <div style={{ fontSize: 14, color: '#8A7A6D', marginTop: 6 }}>
            흩어진 레시피를 한곳에
          </div>
        </div>

        {/* 로그인 / 회원가입 탭 */}
        <div
          style={{
            display: 'flex',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 20,
            border: '1px solid #E3D8C8',
          }}
        >
          <button
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1,
              height: 46,
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              background: mode === 'login' ? '#6B3F5C' : '#FFFDF9',
              color: mode === 'login' ? '#FDF3E0' : '#8A7A6D',
            }}
          >
            로그인
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); }}
            style={{
              flex: 1,
              height: 46,
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 500,
              background: mode === 'signup' ? '#6B3F5C' : '#FFFDF9',
              color: mode === 'signup' ? '#FDF3E0' : '#8A7A6D',
            }}
          >
            회원가입
          </button>
        </div>

        {/* 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder={mode === 'signup' ? '비밀번호 (6자 이상)' : '비밀번호'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {mode === 'login' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: -2,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#6B5A4E',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: '#6B3F5C' }}
                />
                자동 로그인
              </label>
              <span
                onClick={handleForgotPassword}
                style={{ fontSize: 12, color: '#8A7A6D', cursor: 'pointer' }}
              >
                비밀번호를 잊으셨나요?
              </span>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: '#C0392B', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleEmailAuth}
            disabled={loading}
            style={{
              height: 46,
              borderRadius: 12,
              background: '#6B3F5C',
              color: '#FDF3E0',
              fontSize: 15,
              fontWeight: 500,
              border: 'none',
              marginTop: 6,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '10px 0',
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#E3D8C8' }} />
            <div style={{ fontSize: 12, color: '#8A7A6D' }}>또는</div>
            <div style={{ flex: 1, height: 1, background: '#E3D8C8' }} />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              height: 46,
              borderRadius: 12,
              background: '#FFFDF9',
              border: '1px solid #E3D8C8',
              color: '#4A2B40',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.5 6.6-16.5z" />
              <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.3 46 24 46z" />
              <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z" />
              <path fill="#EA4335" d="M24 10.9c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.2 30 2 24 2 15.3 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9 12.4-9z" />
            </svg>
            Google로 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  height: 44,
  borderRadius: 12,
  border: '1px solid #E3D8C8',
  background: '#FFFDF9',
  padding: '0 14px',
  fontSize: 14,
  color: '#4A2B40',
  outline: 'none',
};

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않아요.';
    case 'auth/user-not-found':
      return '가입되지 않은 이메일이에요.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '비밀번호가 일치하지 않아요.';
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일이에요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 해요.';
    case 'auth/popup-closed-by-user':
      return 'Google 로그인 창이 닫혔어요. 다시 시도해주세요.';
    default:
      return '오류가 발생했어요. 다시 시도해주세요.';
  }
}
