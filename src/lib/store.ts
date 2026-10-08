import type { Goal, Learner, Lesson, Level, Word } from "../../shared/types";

export interface Profile extends Learner {
  tutorId: string;
  dailyMinutes: number;
  autoplay: boolean;
  silenceSec?: number; // 말이 이만큼 멈추면 자동 전송. 0 = 자동 전송 안 함(버튼으로만). 없으면 기본값
}

export const DEFAULT_SILENCE_SEC = 4;
export const SILENCE_OPTIONS = [2.5, 4, 6, 0];
export const silenceMsOf = (p: Profile) => (p.silenceSec ?? DEFAULT_SILENCE_SEC) * 1000;

export interface SessionRecord {
  at: string; // ISO
  scenarioId: string;
  tutorId: string;
  minutes: number;
  turns: number;
  avgScore: number | null;
}

export interface Stats {
  streak: number;
  lastDay: string | null; // YYYY-MM-DD (로컬)
  todayMinutes: number;
  sessions: SessionRecord[];
}

const PROFILE_KEY = "tb.profile";
const STATS_KEY = "tb.stats";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 사파리 비공개 모드 등: 저장 실패해도 앱은 계속 동작
  }
}

export const loadProfile = () => read<Profile>(PROFILE_KEY);
export const saveProfile = (p: Profile) => write(PROFILE_KEY, p);

export const defaultProfile = (): Profile => ({
  name: "",
  level: "beginner" as Level,
  goal: "daily" as Goal,
  tutorId: "mia",
  dailyMinutes: 10,
  autoplay: true,
  silenceSec: DEFAULT_SILENCE_SEC,
});

export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d - 1));
}

// 날짜가 바뀌었으면 오늘 분량을 0으로, 하루 이상 비었으면 연속일을 끊는다.
export function loadStats(): Stats {
  const s = read<Stats>(STATS_KEY) ?? { streak: 0, lastDay: null, todayMinutes: 0, sessions: [] };
  const today = localDay();
  if (s.lastDay !== today) {
    s.todayMinutes = 0;
    if (s.lastDay !== dayBefore(today)) s.streak = 0;
  }
  return s;
}

export function recordSession(rec: SessionRecord): Stats {
  const s = loadStats();
  const today = localDay();
  if (s.lastDay !== today) s.streak += 1;
  s.lastDay = today;
  s.todayMinutes += rec.minutes;
  s.sessions = [rec, ...s.sessions].slice(0, 50);
  write(STATS_KEY, s);
  return s;
}

// ---------- 문법 레슨 ----------

const LESSON_DONE_KEY = "tb.lessons";
const LESSON_CACHE_KEY = "tb.lessonCache";

export interface LessonResult {
  score: number;
  total: number;
  at: string;
}

export const loadLessonResults = () => read<Record<string, LessonResult>>(LESSON_DONE_KEY) ?? {};

export function saveLessonResult(id: string, r: LessonResult) {
  const all = loadLessonResults();
  // 최고 점수를 남긴다(다시 풀어서 점수가 떨어져도 완료 표시는 유지)
  if (!all[id] || r.score / r.total >= all[id].score / all[id].total) all[id] = r;
  write(LESSON_DONE_KEY, all);
  return all;
}

// 생성된 레슨은 (레슨, 레벨) 단위로 캐시한다 — 같은 레슨을 다시 열 때 API 비용·대기 없음.
export function cachedLesson(id: string, level: Level): Lesson | null {
  return read<Record<string, Lesson>>(LESSON_CACHE_KEY)?.[`${id}:${level}`] ?? null;
}

export function cacheLesson(id: string, level: Level, lesson: Lesson | null) {
  const all = read<Record<string, Lesson>>(LESSON_CACHE_KEY) ?? {};
  if (lesson) all[`${id}:${level}`] = lesson;
  else delete all[`${id}:${level}`];
  write(LESSON_CACHE_KEY, all);
}

// ---------- 단어장 (라이트너 상자) ----------
// box 0 = 새 단어, 맞힐 때마다 한 칸 위로 → 복습 간격이 길어진다. 틀리면 1로.

const DECK_KEY = "tb.deck";
export const INTERVAL_DAYS = [0, 1, 2, 4, 7, 15];
export const MAX_BOX = INTERVAL_DAYS.length - 1;

export interface Card extends Word {
  box: number;
  due: string; // YYYY-MM-DD
  source: string; // 어디서 왔는지 (대화 시나리오 제목 / 추천 주제)
  added: string;
}

export const loadDeck = () => read<Card[]>(DECK_KEY) ?? [];
const saveDeck = (deck: Card[]) => write(DECK_KEY, deck);
const keyOf = (w: string) => w.trim().toLowerCase();

// 새 단어만 앞에 추가하고 추가된 개수를 돌려준다.
export function addWords(words: Word[], source: string): { deck: Card[]; added: number } {
  const deck = loadDeck();
  const have = new Set(deck.map((c) => keyOf(c.word)));
  const today = localDay();
  const fresh: Card[] = [];
  for (const w of words) {
    const k = keyOf(w.word);
    if (!k || have.has(k)) continue;
    have.add(k);
    fresh.push({ ...w, box: 0, due: today, source, added: today });
  }
  const next = [...fresh, ...deck];
  saveDeck(next);
  return { deck: next, added: fresh.length };
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

export function gradeCard(word: string, known: boolean): Card[] {
  const today = localDay();
  const deck = loadDeck().map((c) => {
    if (keyOf(c.word) !== keyOf(word)) return c;
    const box = known ? Math.min(c.box + 1, MAX_BOX) : 1;
    return { ...c, box, due: known ? addDays(today, INTERVAL_DAYS[box]) : today };
  });
  saveDeck(deck);
  return deck;
}

export function removeCard(word: string): Card[] {
  const deck = loadDeck().filter((c) => keyOf(c.word) !== keyOf(word));
  saveDeck(deck);
  return deck;
}

export const dueCards = (deck: Card[]) => {
  const today = localDay();
  return deck.filter((c) => c.due <= today);
};

// ---------- 발음 클리닉 ----------

const PRON_KEY = "tb.pron";
export const loadPronBest = () => read<Record<string, number>>(PRON_KEY) ?? {};
export function savePronBest(setId: string, avg: number) {
  const all = loadPronBest();
  if (all[setId] === undefined || avg > all[setId]) all[setId] = avg;
  write(PRON_KEY, all);
}

export function resetAll() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(LESSON_DONE_KEY);
    localStorage.removeItem(LESSON_CACHE_KEY);
    localStorage.removeItem(DECK_KEY);
    localStorage.removeItem(PRON_KEY);
  } catch {
    /* noop */
  }
}
