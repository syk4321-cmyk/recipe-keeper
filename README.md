# 내 레시피 서랍

사진이나 텍스트에서 레시피를 정리하고, 폴더·장보기 목록·요리 모드로 관리하는 React PWA입니다.

## 기술 스택

- React + Vite
- pnpm workspace
- Netlify Functions
- Anthropic API

## 로컬 실행

```bash
pnpm install
pnpm --filter @workspace/blank-react-app run dev
```

로컬 Replit 미리보기에서는 기존 Express API 서버도 함께 사용할 수 있습니다.

```bash
pnpm --filter @workspace/api-server run dev
```

## Netlify 배포

저장소 루트를 Netlify 사이트의 Base directory로 사용합니다. 루트의 `netlify.toml`이 다음을 자동으로 설정합니다.

- 프론트엔드 빌드: `artifacts/blank-react-app/dist/public`
- Functions 디렉터리: `netlify/functions`
- `/api/recipe/analyze` → `recipe-analyze` Function 리다이렉트
- SPA 라우팅 fallback

Netlify 사이트 설정에서 다음 환경변수를 추가해야 AI 분석이 작동합니다.

```text
ANTHROPIC_API_KEY
```

Replit Secrets의 값은 GitHub나 Netlify로 자동 이전되지 않습니다. 실제 키는 `.env` 파일이나 소스 코드에 넣지 말고 Netlify의 환경변수 설정 화면에서만 입력하세요.

## GitHub 업로드

```bash
git add .
git commit -m "Prepare recipe app for Netlify"
git branch -M main
git remote add origin https://github.com/<username>/<repository>.git
git push -u origin main
```

GitHub에 올리기 전에 `.env`와 실제 API 키가 포함되지 않았는지 확인하세요. 이 저장소의 `.gitignore`는 로컬 환경변수 파일과 Netlify 임시 디렉터리를 제외합니다.