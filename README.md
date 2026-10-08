# TalkBuddy

AI 튜터 캐릭터와 음성으로 영어 회화를 연습하는 웹 PWA. Learna AI(Codeway)의 핵심 흐름을 참고한 자체 구현이다(이름·캐릭터·문구는 독자 제작).

## 실행

```bash
cp .env.example .env    # ANTHROPIC_API_KEY 입력 (비워 두면 목업 모드)
npm install
npm run dev             # API :8787 + 웹 :5180
```

이 맥 셸에서는 `env -u NODE_OPTIONS npm run dev` 로 실행한다.

### 폰에서 테스트 (HTTPS)

폰 브라우저는 HTTPS 에서만 마이크·음성 인식을 허용한다. `npm run dev:https` 로 띄우면 자체 서명 인증서로
`https://<맥 IP>:5180` 이 열린다(터미널 Network 줄에 주소가 나온다). 폰이 맥과 같은 네트워크에 있어야 하고,
첫 접속 때 인증서 경고를 직접 넘겨야 한다(iOS 사파리: "세부사항 보기 → 이 웹사이트 방문", 안드로이드 크롬: "고급 → 계속").

## AI 제공자 전환 (Claude ↔ Kimi)

`.env` 만 바꾸면 된다(`.env.example` 참고). 서버 시작 로그와 `/api/health` 에 현재 모델이 표시된다.

| | Claude | Kimi |
|---|---|---|
| 키 | `ANTHROPIC_API_KEY` | `ANTHROPIC_AUTH_TOKEN` (Bearer) |
| 주소 | 기본값 | `ANTHROPIC_BASE_URL=https://api.moonshot.ai/anthropic` |
| 모델 | `claude-opus-5-5` | `TALKBUDDY_MODEL=kimi-k3` |
| 차이 | beta 경로 + 거절 시 fallback | 일반 경로, fallback 없음, effort medium→high |

## 구성

| 영역 | 파일 | 내용 |
|---|---|---|
| 화면 | `src/screens/` | 온보딩(이름·목적·레벨·목표시간·튜터) → 하단 탭 [대화 · 문법 · 단어 · 발음]. 대화 탭: Free Talk·롤플레이 7종·연속일·최근 대화 → 대화 → 요약 |
| 문법 | `Lessons.tsx` · `LessonPlayer.tsx` | 레벨별 커리큘럼 15개(`shared/catalog.ts` LESSONS). 설명·예문(듣기)·흔한 실수 → 퀴즈 5문항 → 결과. 생성된 레슨은 (레슨, 레벨) 단위로 localStorage 캐시 |
| 단어 | `Words.tsx` | 대화 요약의 '오늘의 표현' 자동 저장 + 주제별 추천 단어 8개. 플래시카드 복습(라이트너 상자: 간격 1·2·4·7·15일, 모르면 1단계로) |
| 음성 | `src/lib/speech.ts` | 브라우저 Web Speech: 인식(en-US 등)·합성(튜터 억양·성별·레벨별 속도) |
| 저장 | `src/lib/store.ts` | localStorage: 프로필, 연속일, 오늘 학습 분, 최근 세션 50개 |
| 발음 | `Pronounce.tsx` · `PronounceCard.tsx` · `lib/pronounce.ts` | 발음 클리닉 6세트(R/L·F/P·V/B·TH·Z/J·장단모음, 정적). 대화 교정·레슨 예문·단어 카드에도 '따라 말하기'. 채점은 아래 참고 |
| API | `server/index.ts` | `/api/chat`(SSE 스트리밍), `/api/feedback`, `/api/hint`, `/api/translate`, `/api/summary`, `/api/lesson`, `/api/words`, `/api/health` |
| AI | `server/claude.ts` · `prompts.ts` | 기본 Claude `claude-opus-5-5`(거절 시 서버측 fallback). `TALKBUDDY_MODEL` 이 `claude-` 가 아니면 Anthropic 호환 엔드포인트(Kimi 등)로 일반 경로 호출. 대화·교정 effort low, 레슨·요약 medium(Kimi 는 high). 구조화 출력(Zod) |
| 카탈로그 | `shared/catalog.ts` | 튜터 4명(Mia·Jay·Olivia·Liam), 시나리오 8종 |

대화 한 턴마다 튜터 응답(스트리밍)과 교정 피드백(구조화 출력)을 병렬로 요청한다. 튜터는 교정하지 않고 대화만 이어가며, 교정은 사용자 말풍선 아래 칩으로 표시된다.

## 발음 채점 방식과 한계

Claude API 는 음성을 입력으로 받지 않으므로, 브라우저 음성 인식(en-US, 후보 5개 + 신뢰도)을 목표 문장과 **단어 단위로 정렬**해 채점한다(`src/lib/pronounce.ts`, 테스트 `npm test`).

- 단어 상태: 정확 / 비슷(글자 유사도 0.6 이상, 예: rice→lice) / 다르게 들림 / 안 들림. 끼어든 단어는 감점.
- 축약형(I'm=I am)·숫자(3=three)·p.m. 표기 차이는 감점하지 않는다.
- 1순위가 아닌 후보가 더 잘 맞으면 그 후보로 채점하되 8% 깎는다(애매하게 들렸다는 뜻).
- **한계:** 음소 단위 평가가 아니다. "원어민용 인식기가 의도한 단어로 알아들었나"를 재므로 R/L·F/P 처럼 다른 단어가 되는 실수는 잘 잡지만 억양·강세·리듬은 거의 반영되지 않는다. 정밀 채점이 필요하면 Azure 발음 평가 API 같은 엔진으로 `scorePronunciation` 자리를 교체한다.
- 크롬·사파리에서만 동작(파이어폭스는 음성 인식 미지원 안내).
