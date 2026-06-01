# 📋 자기계발 영수증 다이어리

매일 할 일과 핵심 목표를 영수증 형식으로 기록하는 자기계발 다이어리 PWA

## 기능
- **오늘 기록**: To-Do 리스트 + 핵심 3가지 → 결제하기 → 영수증 이미지 저장
- **시간 스케줄**: 핵심 3가지 달성 + 시간 블록 타임라인
- **달력**: 월별 달성 현황 (점 색상으로 표시)
- **앱 설치**: PWA 홈 화면 설치

## 배포 방법

### 1. GitHub 업로드
```bash
git init
git add .
git commit -m "init: 자기계발 영수증 다이어리"
git branch -M main
git remote add origin https://github.com/YOUR_ID/diary-app.git
git push -u origin main
```

### 2. Vercel 배포
1. [vercel.com](https://vercel.com) 로그인
2. "Add New Project" → GitHub 저장소 선택
3. 설정 변경 없이 "Deploy" 클릭
4. 배포 완료! (자동으로 HTTPS 적용)

## 이미지 저장 확인 방법
1. To-Do와 핵심 3가지 입력
2. "결제하기 →" 버튼 클릭
3. 서명란에 서명
4. "⬇ 이미지 저장" 클릭
5. 브라우저 다운로드 폴더에서 `diary-YYYY-MM-DD.png` 확인

> ⚠️ Safari에서는 `toBlob`이 제한될 수 있습니다. Chrome/Edge 권장.

## 로컬 테스트
```bash
npx serve .
# 또는
python3 -m http.server 3000
```
http://localhost:3000 접속

## 파일 구조
```
diary-app/
├── index.html      # 메인 HTML
├── style.css       # 스타일
├── app.js          # 전체 로직
├── sw.js           # Service Worker (PWA 오프라인)
├── manifest.json   # PWA 설정
├── vercel.json     # Vercel 배포 설정
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon.svg
```
