import type { Tutor } from "../../shared/catalog";
import type { Level } from "../../shared/types";
import { liveText, sentenceAlternatives, type Alt, type Segment } from "./transcript";

// ---------- 음성 출력 (Web Speech Synthesis) ----------

const FEMALE = /samantha|karen|moira|tessa|serena|victoria|allison|ava|susan|zira|aria|jenny|libby|sonia|natasha|female|google us english|google uk english female/i;
const MALE = /daniel|alex|fred|aaron|arthur|oliver|tom|guy|ryan|william|david|mark|male/i;

let voices: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  voices = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [];
}
if (typeof speechSynthesis !== "undefined") {
  refreshVoices();
  speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

function pickVoice(tutor: Tutor): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const accent = en.filter((v) => v.lang.replace("_", "-").toLowerCase() === tutor.accent.toLowerCase());
  const gender = tutor.voiceHint === "female" ? FEMALE : MALE;
  const other = tutor.voiceHint === "female" ? MALE : FEMALE;
  const byGender = (list: SpeechSynthesisVoice[]) =>
    list.find((v) => gender.test(v.name) && !(tutor.voiceHint === "male" && FEMALE.test(v.name))) ??
    list.find((v) => !other.test(v.name));
  return byGender(accent) ?? byGender(en) ?? en[0];
}

const RATE: Record<Level, number> = { beginner: 0.85, intermediate: 0.95, advanced: 1.02 };

export const canSpeak = () => typeof speechSynthesis !== "undefined";

function utterance(text: string, tutor: Tutor, level: Level) {
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(tutor);
  if (v) u.voice = v;
  u.lang = v?.lang ?? tutor.accent;
  u.rate = RATE[level];
  return u;
}

// 읽기를 멈출 때마다 올라간다. 멈춘 뒤에 늦게 도착한 문장이 다시 읽히지 않게 하는 표식.
let generation = 0;

export function speak(text: string, tutor: Tutor, level: Level, onEnd?: () => void) {
  if (!canSpeak()) return onEnd?.();
  stopSpeaking();
  const u = utterance(text, tutor, level);
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  generation++;
  if (canSpeak()) speechSynthesis.cancel();
}

// 스트리밍 응답을 문장이 끝나는 대로 이어서 읽는 대기열.
// onStart: 첫 문장을 읽기 시작할 때, onIdle: close() 이후 모든 문장을 다 읽었을 때(또는 멈췄을 때).
export function speechQueue(tutor: Tutor, level: Level, onStart: () => void, onIdle: () => void) {
  const gen = generation;
  let pending = 0;
  let started = false;
  let closed = false;
  let idled = false;
  const idle = () => {
    if (!idled) {
      idled = true;
      onIdle();
    }
  };
  const alive = () => canSpeak() && gen === generation;
  return {
    add(text: string) {
      if (!alive() || !text.trim()) return;
      const u = utterance(text, tutor, level);
      pending++;
      u.onstart = () => {
        if (!started) {
          started = true;
          onStart();
        }
      };
      u.onend = u.onerror = () => {
        pending--;
        if (closed && pending <= 0) idle();
      };
      speechSynthesis.speak(u); // cancel 하지 않는다 — 앞 문장 뒤에 줄 선다
    },
    close() {
      closed = true;
      if (pending <= 0 || !alive()) idle();
    },
  };
}

// ---------- 음성 인식 (Web Speech Recognition) ----------

interface RecognitionAlt {
  transcript: string;
  confidence: number;
}
interface RecognitionResult extends ArrayLike<RecognitionAlt> {
  isFinal: boolean;
}
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;
const Ctor: RecognitionCtor | undefined =
  (globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
    .SpeechRecognition ??
  (globalThis as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

export const canListen = () => !!Ctor;

export interface Listener {
  stop(): void;
}

// 말 사이에 silenceMs 만큼 조용하면 다 말한 것으로 본다(값은 설정에서 고름, 0 = 버튼으로만 종료).
// 브라우저 기본(continuous=false)은 0.5~1초 멈춤에도 끊어 버려서, 단어를 고르며 말하는 학습자의
// 문장이 중간에 잘려 전송됐다.
const NO_SPEECH_MS = 8000; // 시작 후 아무 말이 없을 때(자동 종료 모드에서만)
const MAX_MS = 60000; // 한 번에 듣는 최대 시간

const ERROR_KO = (code: string) =>
  code === "not-allowed" || code === "service-not-allowed"
    ? "마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요."
    : `음성 인식 오류: ${code}`;

// 화면 안내 문구
export const stopHint = (silenceMs: number, action: string) =>
  silenceMs > 0 ? `다 말했으면 버튼을 누르세요 · ${silenceMs / 1000}초 넘게 멈추면 자동 ${action}` : `다 말했으면 버튼을 눌러 ${action}하세요`;

// 연속 인식 세션: 사용자가 stop() 하거나, 말이 silenceMs 동안 멈추면 끝난다.
function session(opts: {
  lang: string;
  silenceMs: number;
  maxAlternatives: number;
  onLive: (text: string) => void;
  onEnd: (segments: Segment[]) => void;
  onError: (msg: string) => void;
}): Listener | null {
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang;
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = opts.maxAlternatives;
  let segments: Segment[] = [];
  let ended = false;
  const auto = opts.silenceMs > 0;
  let silence = auto ? setTimeout(() => rec.stop(), NO_SPEECH_MS) : undefined;
  const hardStop = setTimeout(() => rec.stop(), MAX_MS);

  rec.onresult = (e) => {
    // continuous 모드의 results 는 이 세션의 전체 조각 목록이다 — 매번 처음부터 다시 읽는다.
    segments = Array.from({ length: e.results.length }, (_, i) => {
      const r = e.results[i];
      return { isFinal: r.isFinal, alts: Array.from({ length: r.length }, (_, k) => ({ transcript: r[k].transcript, confidence: r[k].confidence ?? 0 })) };
    });
    opts.onLive(liveText(segments));
    clearTimeout(silence);
    if (auto) silence = setTimeout(() => rec.stop(), opts.silenceMs);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    opts.onError(ERROR_KO(e.error));
  };
  rec.onend = () => {
    if (ended) return;
    ended = true;
    clearTimeout(silence);
    clearTimeout(hardStop);
    opts.onEnd(segments);
  };
  rec.start();
  return { stop: () => rec.stop() };
}

// 대화용: 한 발화를 듣는다. 중간 결과는 onInterim, 끝나면 최종 문장을 onFinal("" = 못 알아들음).
export function listen(
  lang: string,
  silenceMs: number,
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onError: (msg: string) => void,
): Listener | null {
  return session({
    lang,
    silenceMs,
    maxAlternatives: 1,
    onLive: onInterim,
    // 사용자가 직접 멈추면 마지막 조각이 확정되지 않았을 수 있어 중간 결과까지 포함해 보낸다.
    onEnd: (segs) => onFinal(liveText(segs)),
    onError,
  });
}

// 발음 채점용: 문장 후보 여러 개와 신뢰도를 넘긴다(채점은 pronounce.ts).
export type ScoringAlt = Alt;

export function listenForScoring(
  silenceMs: number,
  onInterim: (text: string) => void,
  onDone: (alts: ScoringAlt[]) => void,
  onError: (msg: string) => void,
): Listener | null {
  return session({
    lang: "en-US", // 채점 기준은 튜터 억양과 무관하게 미국 영어 인식기로 고정
    silenceMs,
    maxAlternatives: 5,
    onLive: onInterim,
    onEnd: (segs) => {
      const alts = sentenceAlternatives(segs);
      if (alts.length) return onDone(alts);
      // 확정 조각 없이 끝났으면(직접 멈춤) 중간 결과를 신뢰도 0으로 쓴다
      const live = liveText(segs);
      onDone(live ? [{ transcript: live, confidence: 0 }] : []);
    },
    onError,
  });
}
