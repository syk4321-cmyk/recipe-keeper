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
