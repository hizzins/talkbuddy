import type { Tutor } from "../../shared/catalog";
import type { Level } from "../../shared/types";

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

export function speak(text: string, tutor: Tutor, level: Level, onEnd?: () => void) {
  if (!canSpeak()) return onEnd?.();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(tutor);
  if (v) u.voice = v;
  u.lang = v?.lang ?? tutor.accent;
  u.rate = RATE[level];
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
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

// 한 문장을 듣는다: 중간 결과는 onInterim, 끝나면 최종 문장을 onFinal("" = 못 알아들음).
export function listen(
  lang: string,
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onError: (msg: string) => void,
): Listener | null {
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  let latest = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    latest = (finalText + interim).trim();
    onInterim(latest);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    onError(
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요."
        : `음성 인식 오류: ${e.error}`,
    );
  };
  // 사용자가 직접 멈춘 경우 isFinal 이 안 올 수 있어 마지막 중간 결과를 쓴다.
  rec.onend = () => onFinal((finalText || latest).trim());
  rec.start();
  return { stop: () => rec.stop() };
}

// 발음 채점용: 후보 문장 여러 개와 신뢰도를 그대로 넘긴다(채점은 pronounce.ts).
export interface ScoringAlt {
  transcript: string;
  confidence: number;
}

export function listenForScoring(
  onInterim: (text: string) => void,
  onDone: (alts: ScoringAlt[]) => void,
  onError: (msg: string) => void,
): Listener | null {
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US"; // 채점 기준은 튜터 억양과 무관하게 미국 영어 인식기로 고정
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 5;
  let finals: RecognitionResult[] = [];
  let latest = "";
  rec.onresult = (e) => {
    finals = [];
    let text = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finals.push(r);
      text += r[0].transcript;
    }
    latest = text.trim();
    onInterim(latest);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    onError(
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요."
        : `음성 인식 오류: ${e.error}`,
    );
  };
  // 결과 조각마다 후보가 따로 오므로 k번째 후보끼리 이어 붙여 k번째 문장 후보를 만든다.
  // 사용자가 직접 멈춰 확정 결과가 없으면 마지막 중간 결과를 신뢰도 0으로 쓴다.
  rec.onend = () => {
    if (finals.length === 0) return onDone(latest ? [{ transcript: latest, confidence: 0 }] : []);
    const k = Math.max(...finals.map((r) => r.length));
    const alts: ScoringAlt[] = [];
    for (let a = 0; a < k; a++) {
      const parts = finals.map((r) => r[Math.min(a, r.length - 1)]);
      alts.push({
        transcript: parts.map((p) => p.transcript.trim()).join(" "),
        confidence: Math.min(...parts.map((p) => p.confidence ?? 0)),
      });
    }
    onDone(alts);
  };
  rec.start();
  return { stop: () => rec.stop() };
}
