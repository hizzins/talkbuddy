import { useEffect, useRef, useState } from "react";
import { findScenario, findTutor } from "../../shared/catalog";
import type { Feedback, Hint, Turn } from "../../shared/types";
import type { FinishedSession } from "../App";
import { Avatar, Icon, Sheet } from "../components";
import { PronounceSheet } from "../PronounceCard";
import { getFeedback, getHint, streamChat, translate } from "../lib/api";
import { canListen, listen, speak, stopHint, stopSpeaking, type Listener } from "../lib/speech";
import { silenceMsOf, type Profile } from "../lib/store";

interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
  pending?: boolean; // 튜터 응답 스트리밍 중
  error?: string;
  feedback?: Feedback | "loading" | "error";
  open?: boolean; // 피드백 펼침
  translation?: string | "loading";
  showTr?: boolean;
}

interface Props {
  profile: Profile;
  scenarioId: string;
  onExit: () => void;
  onFinish: (s: FinishedSession) => void;
}

let seq = 0;

export default function Chat({ profile, scenarioId, onExit, onFinish }: Props) {
  const tutor = findTutor(profile.tutorId);
  const scenario = findScenario(scenarioId);
  const learner = { name: profile.name, level: profile.level, goal: profile.goal };

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [typing, setTyping] = useState(!canListen());
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [hints, setHints] = useState<Hint | "loading" | null>(null);
  const [pronText, setPronText] = useState<string | null>(null);

  const startedAt = useRef(Date.now());
  const listener = useRef<Listener | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  const patch = (id: number, p: Partial<Msg>) => setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));

  // 완료된 메시지만 대화 기록으로 보낸다(실패·스트리밍 중인 응답 제외).
  const turnsOf = (ms: Msg[]): Turn[] => ms.filter((m) => !m.pending && !m.error && m.text).map((m) => ({ role: m.role, text: m.text }));

  const say = (id: number, text: string) => {
    setSpeakingId(id);
    speak(text, tutor, profile.level, () => setSpeakingId((cur) => (cur === id ? null : cur)));
  };

  async function reply(history: Turn[]) {
    const id = ++seq;
    setBusy(true);
    setMsgs((ms) => [...ms, { id, role: "assistant", text: "", pending: true }]);
    try {
      const text = await streamChat({ tutorId: tutor.id, scenarioId, learner, history }, (d) =>
        setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, text: m.text + d } : m))),
      );
      patch(id, { text, pending: false });
      if (profile.autoplay) say(id, text);
    } catch (e) {
      patch(id, { pending: false, error: e instanceof Error ? e.message : "오류가 났어요" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (opened.current) return; // StrictMode 이중 실행 방지
    opened.current = true;
    reply([]);
    return () => {
      stopSpeaking();
      listener.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, interim]);

  function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    stopSpeaking();
    setDraft("");
    setInterim("");
    const ms = msgsRef.current;
    const tutorLine = [...ms].reverse().find((m) => m.role === "assistant" && !m.error)?.text ?? "";
    const id = ++seq;
    const userMsg: Msg = { id, role: "user", text, feedback: "loading" };
    setMsgs([...ms, userMsg]);
    getFeedback({ learner, tutorLine, userLine: text })
      .then((f) => patch(id, { feedback: f }))
      .catch(() => patch(id, { feedback: "error" }));
    reply(turnsOf([...ms, userMsg]));
  }

  function retry(id: number) {
    const ms = msgsRef.current.filter((m) => m.id !== id);
    setMsgs(ms);
    reply(turnsOf(ms));
  }

  function toggleMic() {
    if (listening) {
      listener.current?.stop();
      return;
    }
    stopSpeaking();
    setSpeakingId(null);
    const l = listen(
      tutor.accent,
      silenceMsOf(profile),
      setInterim,
      (final) => {
        setListening(false);
        listener.current = null;
        if (final) send(final);
        else setInterim("");
      },
      (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3500);
      },
    );
    if (l) {
      listener.current = l;
      setListening(true);
      setInterim("");
    }
  }

  async function toggleTranslation(m: Msg) {
    if (m.translation && m.translation !== "loading") return patch(m.id, { showTr: !m.showTr });
    patch(m.id, { translation: "loading", showTr: true });
    try {
      patch(m.id, { translation: await translate(m.text) });
    } catch {
      patch(m.id, { translation: undefined, showTr: false });
    }
  }

  async function openHints() {
    setHints("loading");
    try {
      setHints(await getHint({ learner, scenarioId, history: turnsOf(msgsRef.current) }));
    } catch (e) {
      setHints(null);
      setToast(e instanceof Error ? e.message : "힌트를 불러오지 못했어요");
      setTimeout(() => setToast(""), 3000);
    }
  }

  function finish() {
    stopSpeaking();
    listener.current?.stop();
    const ms = msgsRef.current;
    const userTurns = ms.filter((m) => m.role === "user");
    if (userTurns.length === 0) return onExit();
    onFinish({
      scenarioId,
      tutorId: tutor.id,
      history: turnsOf(ms),
      feedback: userTurns.filter((m) => typeof m.feedback === "object").map((m) => ({ userLine: m.text, feedback: m.feedback as Feedback })),
      startedAt: startedAt.current,
    });
  }

  return (
    <div className="screen chat">
      <header className="chat-head">
        <button className="icon-btn" onClick={onExit} aria-label="나가기">
          <Icon name="back" />
        </button>
        <Avatar tutor={tutor} size={40} talking={speakingId !== null} />
        <div className="chat-title">
          <strong>{tutor.name}</strong>
          <span className="muted small">{scenario.titleKo}</span>
        </div>
        <button className="btn small outline" onClick={finish}>
          종료
        </button>
      </header>

      <main className="messages">
        {msgs.map((m) =>
          m.role === "assistant" ? (
            <div key={m.id} className="row tutor">
              <Avatar tutor={tutor} size={30} talking={speakingId === m.id} />
              <div className="bubble-wrap">
                <div className={`bubble tutor ${m.error ? "err" : ""}`}>
                  {m.error ? (
                    <>
                      {m.error}{" "}
                      <button className="link" onClick={() => retry(m.id)}>
                        다시 시도
                      </button>
                    </>
                  ) : m.text ? (
                    m.text
                  ) : (
                    <span className="dots">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {m.showTr && <div className="translation">{m.translation === "loading" ? "번역 중…" : m.translation}</div>}
                </div>
                {!m.pending && !m.error && (
                  <div className="bubble-actions">
                    <button onClick={() => say(m.id, m.text)} aria-label="다시 듣기">
                      <Icon name="speaker" size={16} />
                    </button>
                    <button onClick={() => toggleTranslation(m)} aria-label="번역">
                      <Icon name="translate" size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key={m.id} className="row user">
              <div className="bubble-wrap">
                <div className="bubble user">{m.text}</div>
                <FeedbackChip
                  m={m}
                  onToggle={() => patch(m.id, { open: !m.open })}
                  onSay={(t) => say(m.id, t)}
                  onPractice={(t) => {
                    stopSpeaking();
                    setPronText(t);
                  }}
                />
              </div>
            </div>
          ),
        )}
        {listening && (
          <div className="row user">
            <div className="bubble user ghost">{interim || "듣고 있어요…"}</div>
          </div>
        )}
        <div ref={bottom} />
      </main>

      {toast && <div className="toast">{toast}</div>}

      <footer className="composer">
        {typing ? (
          <form
            className="type-row"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            {canListen() && (
              <button type="button" className="icon-btn" onClick={() => setTyping(false)} aria-label="음성으로 말하기">
                <Icon name="mic" />
              </button>
            )}
            <input className="text-input" placeholder="영어로 입력하세요" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <button className="icon-btn primary" disabled={!draft.trim() || busy} aria-label="보내기">
              <Icon name="send" />
            </button>
          </form>
        ) : (
          <div className="voice-row">
            <button className="side-btn" onClick={openHints} disabled={busy}>
              <Icon name="bulb" />
              <span>힌트</span>
            </button>
            <button className={`mic ${listening ? "on" : ""}`} onClick={toggleMic} disabled={busy && !listening} aria-label={listening ? "그만 듣기" : "말하기"}>
              <Icon name={listening ? "stop" : "mic"} size={30} />
            </button>
            <button className="side-btn" onClick={() => setTyping(true)}>
              <Icon name="keyboard" />
              <span>입력</span>
            </button>
          </div>
        )}
        {!typing && <p className="muted small center">{busy ? `${tutor.name}가 답하는 중…` : listening ? stopHint(silenceMsOf(profile), "전송") : "버튼을 누르고 영어로 말해 보세요"}</p>}
      </footer>

      <PronounceSheet text={pronText} tutor={tutor} level={profile.level} silenceMs={silenceMsOf(profile)} onClose={() => setPronText(null)} />

      <Sheet open={hints !== null} onClose={() => setHints(null)} title="이렇게 말해 보세요">
        {hints === "loading" ? (
          <p className="muted">추천 문장을 만드는 중…</p>
        ) : (
          hints?.suggestions.map((s, i) => (
            <button
              key={i}
              className="hint"
              onClick={() => {
                setHints(null);
                setDraft(s.en);
                setTyping(true);
              }}
            >
              <strong>{s.en}</strong>
              <span>{s.ko}</span>
            </button>
          ))
        )}
        <p className="muted small">문장을 누르면 입력창에 채워져요. 소리 내어 읽고 보내 보세요.</p>
      </Sheet>
    </div>
  );
}

function FeedbackChip({ m, onToggle, onSay, onPractice }: { m: Msg; onToggle: () => void; onSay: (t: string) => void; onPractice: (t: string) => void }) {
  const f = m.feedback;
  if (f === "loading") return <div className="fb-chip loading">교정 확인 중…</div>;
  if (!f || f === "error") return null;
  const label = f.verdict === "perfect" ? "완벽해요!" : f.verdict === "minor" ? "더 자연스럽게" : "고쳐 볼까요?";
  return (
    <div className={`fb ${f.verdict}`}>
      <button className="fb-chip" onClick={onToggle}>
        <span>{label}</span>
        <b>{f.score}</b>
      </button>
      {m.open && (
        <div className="fb-body">
          {f.verdict !== "perfect" && (
            <p>
              <em>교정</em> {f.corrected}
            </p>
          )}
          {f.natural_alternative && f.natural_alternative !== f.corrected && (
            <p>
              <em>원어민식</em> {f.natural_alternative}{" "}
              <button className="link" onClick={() => onSay(f.natural_alternative)} aria-label="듣기">
                <Icon name="speaker" size={14} />
              </button>
            </p>
          )}
          <p className="ko">{f.explanation_ko}</p>
          <button className="btn small practice" onClick={() => onPractice(f.natural_alternative || f.corrected)}>
            <Icon name="mic" size={14} /> 이 문장 따라 말하기
          </button>
        </div>
      )}
    </div>
  );
}
