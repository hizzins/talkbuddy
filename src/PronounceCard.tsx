import { useEffect, useRef, useState } from "react";
import type { Tutor } from "../shared/catalog";
import type { Level } from "../shared/types";
import { Icon, Sheet } from "./components";
import { scorePronunciation, verdict, type PronounceResult } from "./lib/pronounce";
import { canListen, listenForScoring, speak, stopSpeaking, type Listener } from "./lib/speech";

const STATUS_KO = { good: "정확", close: "비슷", wrong: "다르게 들림", missing: "안 들림" } as const;

interface Props {
  text: string;
  ko?: string;
  tutor: Tutor;
  level: Level;
  onResult?: (r: PronounceResult) => void;
}

// 문장 하나를 듣고 → 따라 말하고 → 단어별로 채점한다.
export default function PronounceCard({ text, ko, tutor, level, onResult }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<PronounceResult | null>(null);
  const [error, setError] = useState("");
  const listener = useRef<Listener | null>(null);

  // 문장이 바뀌면(다음 문제) 초기화
  useEffect(() => {
    setResult(null);
    setInterim("");
    setError("");
    return () => {
      listener.current?.stop();
      stopSpeaking();
    };
  }, [text]);

  function toggle() {
    if (listening) return listener.current?.stop();
    stopSpeaking();
    setError("");
    setResult(null);
    setInterim("");
    const l = listenForScoring(
      setInterim,
      (alts) => {
        setListening(false);
        listener.current = null;
        if (alts.length === 0) {
          setError("소리가 들리지 않았어요. 마이크 가까이에서 다시 말해 보세요.");
          return;
        }
        const r = scorePronunciation(text, alts);
        setResult(r);
        onResult?.(r);
      },
      (msg) => {
        setError(msg);
      },
    );
    if (l) {
      listener.current = l;
      setListening(true);
    }
  }

  if (!canListen())
    return (
      <div className="pron-card">
        <p className="pron-sentence">{text}</p>
        <p className="muted small">이 브라우저는 음성 인식을 지원하지 않아요. 크롬이나 사파리에서 열어 주세요.</p>
      </div>
    );

  return (
    <div className="pron-card">
      <p className="pron-sentence" aria-live="polite">
        {result
          ? result.words.map((w, i) => (
              <span key={i} className={`pw ${w.status}`} title={STATUS_KO[w.status]}>
                {w.word}
                {w.heard && <small>{w.heard}</small>}
              </span>
            ))
          : text}
      </p>
      {ko && <p className="muted small">{ko}</p>}

      <div className="pron-controls">
        <button className="side-btn" onClick={() => speak(text, tutor, level)} disabled={listening}>
          <Icon name="speaker" />
          <span>먼저 듣기</span>
        </button>
        <button className={`mic ${listening ? "on" : ""}`} onClick={toggle} aria-label={listening ? "그만 듣기" : "따라 말하기"}>
          <Icon name={listening ? "stop" : "mic"} size={30} />
        </button>
        <span className="side-btn ghost" aria-hidden />
      </div>

      {listening && <p className="pron-interim">{interim || "듣고 있어요… 문장을 읽어 주세요"}</p>}
      {error && <p className="pron-error">{error}</p>}

      {result && (
        <div className="pron-result">
          <div className={`pron-score ${result.score >= 90 ? "great" : result.score >= 75 ? "good" : result.score >= 50 ? "ok" : "low"}`}>
            <b>{result.score}</b>
            <span>점</span>
          </div>
          <div className="pron-msg">
            <strong>{verdict(result.score)}</strong>
            <span className="muted small">들린 문장: {result.heard || "-"}</span>
            {result.words.some((w) => w.status !== "good") && (
              <span className="legend small">
                <i className="close" /> 비슷 <i className="wrong" /> 다르게 들림 <i className="missing" /> 안 들림
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 대화 교정·레슨 예문·단어 카드에서 띄우는 따라 말하기 시트
export function PronounceSheet(props: { text: string | null; ko?: string; tutor: Tutor; level: Level; onClose: () => void }) {
  return (
    <Sheet open={props.text !== null} onClose={props.onClose} title="따라 말하기">
      {props.text && <PronounceCard text={props.text} ko={props.ko} tutor={props.tutor} level={props.level} />}
    </Sheet>
  );
}
