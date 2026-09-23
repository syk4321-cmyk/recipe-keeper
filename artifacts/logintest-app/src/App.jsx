import React, { useState } from 'react';
import {
  signInWithCredential,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth } from './firebase';

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [log, setLog] = useState('');

  const appendLog = (line) => setLog((prev) => prev + line + '\n');

  const handleGoogleLogin = async () => {
    setStatus('loading');
    setLog('');
    appendLog(`플랫폼: ${Capacitor.getPlatform()} (native: ${Capacitor.isNativePlatform()})`);

    try {
      await setPersistence(auth, browserLocalPersistence);

      if (Capacitor.isNativePlatform()) {
        appendLog('FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true }) 호출...');
        const { credential, user } = await FirebaseAuthentication.signInWithGoogle({
          useCredentialManager: true,
        });
        appendLog(`네이티브 결과: idToken 존재 여부 = ${!!credential?.idToken}, user.email = ${user?.email ?? '(none)'}`);

        if (!credential?.idToken) {
          throw new Error('구글 로그인 idToken을 가져오지 못했습니다.');
        }

        appendLog('firebase/auth JS SDK로 signInWithCredential 호출...');
        const authCredential = GoogleAuthProvider.credential(credential.idToken);
        const result = await signInWithCredential(auth, authCredential);
        appendLog(`✅ 성공! Firebase 로그인 사용자: ${result.user.email}`);
        setStatus('success');
      } else {
        appendLog('네이티브 플랫폼이 아닙니다 — 이 앱은 네이티브(Android) 재현 실험 전용입니다.');
        setStatus('error');
      }
    } catch (err) {
      appendLog('❌ 실패');
      appendLog(`code: ${err?.code ?? '(none)'}`);
      appendLog(`message: ${err?.message ?? '(none)'}`);
      appendLog(`전체 에러 객체: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
      setStatus('error');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'sans-serif',
        gap: 16,
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: 20, textAlign: 'center' }}>쿡마크 구글 로그인 재현 테스트</h1>
      <p style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
        구글 로그인 버튼만 있는 최소 테스트 앱입니다.
        <br />
        패키지명: com.cookmark.logintest / 프로젝트: cookmark-logintest
      </p>

      <button
        onClick={handleGoogleLogin}
        disabled={status === 'loading'}
        style={{
          padding: '14px 28px',
          fontSize: 16,
          borderRadius: 8,
          border: '1px solid #ccc',
          background: status === 'loading' ? '#eee' : '#fff',
          cursor: status === 'loading' ? 'default' : 'pointer',
        }}
      >
        {status === 'loading' ? '로그인 시도 중...' : 'Google로 로그인 테스트'}
      </button>

      {log && (
        <pre
          style={{
            width: '100%',
            maxWidth: 480,
            background: status === 'success' ? '#eaffea' : status === 'error' ? '#ffecec' : '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {log}
        </pre>
      )}
    </div>
  );
}
