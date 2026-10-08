// 발음 채점: 브라우저 음성 인식 결과(후보 여러 개 + 신뢰도)를 목표 문장과 단어 단위로 정렬해 점수를 낸다.
// 음소 단위 평가가 아니라 "원어민용 인식기가 의도대로 알아들었는가"를 잰다 — 그래서 R/L 처럼
// 다른 단어로 들리는 실수(rice → lice)는 잘 잡지만, 억양·강세는 거의 반영되지 않는다.

export type WordStatus = "good" | "close" | "wrong" | "missing";

export interface WordResult {
  word: string; // 화면에 보여줄 원래 단어(구두점 포함)
  status: WordStatus;
  heard?: string; // close/wrong 일 때 인식된 단어
}

export interface Alternative {
  transcript: string;
  confidence: number; // 0이면 브라우저가 값을 안 준 것(사파리 등)
}

export interface PronounceResult {
  score: number; // 0-100
  words: WordResult[];
  extra: string[]; // 목표에 없는데 인식된 단어
  heard: string; // 채점에 쓴 인식 문장
}

const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
  "it's": "it is", "that's": "that is", "he's": "he is", "she's": "she is", "what's": "what is",
  "there's": "there is", "here's": "here is", "who's": "who is", "where's": "where is", "how's": "how is",
  "let's": "let us", "i'll": "i will", "you'll": "you will", "we'll": "we will", "they'll": "they will",
  "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have", "i'd": "i would",
  "you'd": "you would", "can't": "can not", "cannot": "can not", "won't": "will not", "shan't": "shall not",
};

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function numberWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
  return String(n);
}

// 표시용 단어 목록과 비교용 토큰 목록을 함께 만든다. 축약형이 두 토큰이 되면 표시 단어를 공유한다.
export function tokenize(text: string): { display: string[]; tokens: string[]; owner: number[] } {
  const display = text.trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  const owner: number[] = [];
  display.forEach((raw, i) => {
    let w = raw.toLowerCase().replace(/[’‘]/g, "'");
    w = w.replace(/\b([ap])\.m\.?/g, "$1m");
    w = w.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
    if (!w) return;
    const expanded = CONTRACTIONS[w] ?? w.replace(/n't$/, " not");
    for (let part of expanded.split(/[\s-]+/)) {
      part = part.replace(/'s$/, "s").replace(/'/g, "");
      if (!part) continue;
      if (/^\d+$/.test(part)) {
        for (const nw of numberWords(Number(part)).split(" ")) {
          tokens.push(nw);
          owner.push(i);
        }
      } else {
        tokens.push(part);
        owner.push(i);
      }
    }
  });
  return { display, tokens, owner };
}

function charDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  return 1 - charDistance(a, b) / Math.max(a.length, b.length);
}

const CLOSE = 0.6; // 이 이상 비슷하면 "비슷함"(lice vs rice = 0.75, bit vs beat = 0.5)
const CREDIT: Record<WordStatus, number> = { good: 1, close: 0.6, wrong: 0, missing: 0 };

type Op = { kind: "match" | "sub"; t: number; h: number } | { kind: "del"; t: number } | { kind: "ins"; h: number };

// 단어 단위 편집 거리 정렬. 치환 비용은 글자 유사도에 비례해 비슷한 단어끼리 짝지어지게 한다.
function align(target: string[], heard: string[]): Op[] {
  const n = target.length;
  const m = heard.length;
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i;
  for (let j = 0; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      cost[i][j] = Math.min(
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
        cost[i - 1][j - 1] + (1 - similarity(target[i - 1], heard[j - 1])) * 1.5,
      );
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sub = cost[i - 1][j - 1] + (1 - similarity(target[i - 1], heard[j - 1])) * 1.5;
      if (Math.abs(cost[i][j] - sub) < 1e-9) {
        ops.push({ kind: target[i - 1] === heard[j - 1] ? "match" : "sub", t: i - 1, h: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && Math.abs(cost[i][j] - (cost[i - 1][j] + 1)) < 1e-9) {
      ops.push({ kind: "del", t: --i });
    } else {
      ops.push({ kind: "ins", h: --j });
    }
  }
  return ops.reverse();
}

function scoreOne(targetText: string, alt: Alternative): PronounceResult {
  const t = tokenize(targetText);
  const h = tokenize(alt.transcript);
  const tokenStatus: WordStatus[] = new Array(t.tokens.length).fill("missing");
  const tokenHeard: (string | undefined)[] = new Array(t.tokens.length).fill(undefined);
  const extra: string[] = [];
  for (const op of align(t.tokens, h.tokens)) {
    if (op.kind === "match") tokenStatus[op.t] = "good";
    else if (op.kind === "sub") {
      const sim = similarity(t.tokens[op.t], h.tokens[op.h]);
      tokenStatus[op.t] = sim >= CLOSE ? "close" : "wrong";
      tokenHeard[op.t] = h.tokens[op.h];
    } else if (op.kind === "ins") extra.push(h.tokens[op.h]);
  }

  // 표시 단어 하나에 토큰이 여러 개면(축약형·숫자) 가장 나쁜 상태를 따른다.
  const rank: WordStatus[] = ["good", "close", "wrong", "missing"];
  const words: WordResult[] = t.display.map((word) => ({ word, status: "good" as WordStatus }));
  t.owner.forEach((d, k) => {
    if (rank.indexOf(tokenStatus[k]) > rank.indexOf(words[d].status)) {
      words[d].status = tokenStatus[k];
      words[d].heard = tokenHeard[k];
    }
  });

  const n = Math.max(1, t.tokens.length);
  let acc = tokenStatus.reduce((s, st) => s + CREDIT[st], 0) / n;
  acc -= Math.min(0.3, (extra.length * 0.5) / n); // 엉뚱한 단어가 끼어들면 감점(상한 30%)
  if (alt.confidence > 0) acc *= 0.85 + 0.15 * alt.confidence;
  return { score: Math.max(0, Math.min(100, Math.round(acc * 100))), words, extra, heard: alt.transcript };
}

// 인식기의 1순위가 아닌 후보가 더 잘 맞으면 그걸 쓰되 약간 깎는다(애매하게 들렸다는 뜻).
export function scorePronunciation(targetText: string, alternatives: Alternative[]): PronounceResult {
  const alts = alternatives.filter((a) => a.transcript.trim());
  if (alts.length === 0) {
    const t = tokenize(targetText);
    return { score: 0, words: t.display.map((word) => ({ word, status: "missing" })), extra: [], heard: "" };
  }
  let best: PronounceResult | null = null;
  alts.forEach((alt, i) => {
    const r = scoreOne(targetText, alt);
    const adjusted = i === 0 ? r : { ...r, score: Math.round(r.score * 0.92) };
    if (!best || adjusted.score > best.score) best = adjusted;
  });
  return best!;
}

export function verdict(score: number): string {
  if (score >= 90) return "원어민처럼 또렷하게 들려요!";
  if (score >= 75) return "좋아요! 색이 다른 단어만 다듬어 봐요.";
  if (score >= 50) return "조금 더 또박또박, 천천히 말해 봐요.";
  return "먼저 들어 보고 한 단어씩 따라 해 봐요.";
}
