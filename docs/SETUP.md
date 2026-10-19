# 실행·Firebase 연결·배포

## Python 테스트 서버
프로젝트 루트에서 실행한다. Python이 PATH에 없으면 설치된 Python 실행 파일의 전체 경로를 사용한다.

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

브라우저에서 http://127.0.0.1:8765 에 접속한다. HTML/CSS/순수 JavaScript의 ES 모듈로 동작하며 npm 빌드 과정이 없다.

## Firebase 실제 연결
1. Firebase Console에서 사용할 프로젝트에 웹 앱을 등록한다.
2. Realtime Database를 생성한다. Firestore가 아닌 Realtime Database를 선택한다.
3. 프로젝트 설정의 웹 앱 설정을 `js/firebase-config.js`에 입력한다. `databaseURL`은 실제 생성한 DB 주소이며 지역에 따라 `firebaseio.com` 또는 `firebasedatabase.app` 도메인을 사용한다.
4. Authentication에서 Anonymous(익명) 로그인을 활성화한다.
5. Realtime Database 규칙에 `firebase/database.rules.json` 내용을 적용한다.
6. Python 서버에서 아이디로 입장하여 연습하고 작업종료 후 DB 콘솔과 나의 연습 기록에서 확인한다.

웹 앱 설정은 공개 식별자다. 서비스 계정 비밀키, 데이터베이스 관리자 비밀번호, GitHub/Vercel 토큰은 웹 소스에 넣지 않는다.

### 아이디와 접근 모델
요청에 맞춰 비밀번호 없이 아이디를 입력하여 기록을 구분한다. Firebase 익명 인증은 API 호출에 사용하며, 앱에 입력하는 아이디와 Firebase 인증 UID는 별개다. 같은 아이디를 아는 사람은 새 브라우저에서도 해당 기록을 조회하고 추가할 수 있다. 제공한 DB 규칙은 인증 없는 접근을 거절하지만 아이디 소유권을 증명하지 않는다. 개인별 비공개 기록이나 사칭 방지가 필요하면 실제 계정 로그인 요구사항과 DB 경로/규칙을 함께 변경해야 한다. 개인 정보나 비밀 입력문장은 저장하지 않는다.

### DB 경로 및 필드
`practice/{아이디의 UTF-8 hex}/days/{YYYY-MM-DD}`

| 필드 | 의미 |
| --- | --- |
| userId | 사용자가 입력한 아이디 (필수) |
| practiceDate | 한국 시간 기준 연습 날짜 (필수) |
| highestScore | 해당 날짜 최고 점수 (필수) |
| attemptCount | 정상 완료한 연습 횟수 |
| averageScore | 회차별 점수의 산술 평균 |
| averageSpeed / averageAccuracy | 회차별 속도/정확도의 산술 평균 |
| totalPracticeSeconds / totalQuestions | 누적 연습 시간/제출 문제 수 |
| attempts | UUID별 회차 기록. 점수, 속도, 정확도, 언어, 유형, 설정, 완료 시각 포함 |
| updatedAt / schemaVersion | 마지막 저장 시각과 스키마 버전 |

ETag 조건부 쓰기로 기존 기록을 다시 읽고 고유 회차 ID로 합친다. 같은 회차를 재전송해도 중복 집계하지 않는다. 저장은 서버 성공 응답을 받은 뒤에만 완료 표시한다.

### 저장 시점
- 제한 시간 또는 목표 횟수 완료: 브라우저에 당일 기록을 임시 보관한다. DB에는 아직 쓰지 않는다.
- 작업종료: 그날 임시 기록의 저장을 승인하고 기존 DB 기록과 합쳐 일일 평균과 최고점수를 저장한다.
- 같은 날짜 재접속: 로컬 기록과 DB에 저장된 당일 기록을 함께 표시한다.
- 창을 닫거나 새로고침: DB 쓰기를 하지 않는다.
- 화면이 열려 자정을 넘기거나 백그라운드 화면으로 돌아왔을 때 날짜 변경을 감지: 전날 완료 기록을 자동 정산하고 오늘 화면을 비운다. 진행 중 미완료 연습은 취소한다.
- 창이 닫혀 있는 동안에는 자정 처리를 실행할 수 없다. 다음날 새 접속에서 전날 미승인 임시 기록은 자동 저장하지 않는다.
- 작업종료/날짜 변경으로 저장 승인을 했지만 실패한 기록: 이 브라우저에 보관하고 다음 접속 또는 작업종료 때 재시도한다.

## 자동 테스트 재현
테스트 도구는 프로젝트 외부에 설치한다. 다음은 Windows PowerShell 예시다. Firebase 에뮬레이터는 Java 21 이상이 필요하다.

```powershell
npm.cmd install --prefix "$env:LOCALAPPDATA/CodexTypingTestTools" playwright firebase-tools
& "$env:LOCALAPPDATA/CodexTypingTestTools/node_modules/.bin/playwright.cmd" install chromium
```

터미널 1: 위의 Python 서버를 실행한다.

터미널 2: 프로젝트 루트에서 아래 명령으로 `firebase/`를 작업 디렉터리로 사용한다. 실행 로그도 해당 디렉터리에 생성되며 Git에는 포함하지 않는다.

```powershell
Push-Location firebase
& "$env:LOCALAPPDATA/CodexTypingTestTools/node_modules/.bin/firebase.cmd" emulators:start --only auth,database --project demo-typing-game --config emulator.json
Pop-Location
```

터미널 3: 프로젝트 루트에서 테스트한다.

```powershell
node --test js/tests/core.test.js js/tests/database.test.js
node js/tests/browser.test.js
```

브라우저 테스트는 테스트 컨텍스트에서만 Firebase 설정과 요청을 로컬 에뮬레이터로 연결한다. 실제 서비스 설정 파일은 바꾸지 않는다. `TYPING_TEST_TOOLS`, `TYPING_TEST_URL` 환경 변수로 도구 설치 경로와 Python 서버 URL을 지정할 수 있다. 설치된 Microsoft Edge로 테스트하려면 `$env:TYPING_TEST_BROWSER = 'msedge'`를 설정한 뒤 실행한다. 이때 별도 Chromium 다운로드는 필요 없다. DB 에뮬레이터의 테스트 네임스페이스는 `demo-typing-game-default-rtdb`다.

## GitHub 업로드 및 Vercel 배포
1. 사용할 GitHub 저장소 주소와 쓰기 권한을 확인한다.
2. 실제 Firebase 설정 후 Python 서버 테스트와 실제 DB 저장/조회까지 확인한다.
3. 루트에서 Git 저장소를 초기화하고 `.gitignore`를 적용하여 완료 소스를 커밋한 뒤 GitHub로 push한다.
4. Vercel에서 GitHub 저장소를 가져온다. Framework Preset은 Other, Root Directory는 루트, Build Command는 비워 두고 Output Directory는 `.`로 설정한다. 별도 패키지 설치가 필요 없다.
5. 배포 URL에서 최초 팝업, 한글/영문 연습, Enter 제출, 작업종료 저장, 다른 브라우저에서 기록 조회와 그래프까지 다시 확인한다.

Firebase 프로젝트 설정 및 GitHub/Vercel 대상과 인증이 제공되기 전에는 실제 클라우드 연동·업로드·배포가 완료된 상태가 아니다.

## 공식 API 참고
- [Firebase REST 데이터 쓰기와 ETag](https://firebase.google.com/docs/database/rest/save-data)
- [Firebase Authentication REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Realtime Database 보안 규칙](https://firebase.google.com/docs/database/security/core-syntax)
- [Vercel Git 저장소 배포](https://vercel.com/docs/git)
