import { useEffect, useState } from "react";
import { WORD_TOPICS, findTutor } from "../../shared/catalog";
import { Icon } from "../components";
import { PronounceSheet } from "../PronounceCard";
import { getWords } from "../lib/api";
import { speak, stopSpeaking } from "../lib/speech";
import { MAX_BOX, addWords, dueCards, gradeCard, loadDeck, removeCard, type Card, type Profile } from "../lib/store";

const STUDY_LIMIT = 20;

export default function Words({ profile, onDeckChange }: { profile: Profile; onDeckChange: () => void }) {
  const [deck, setDeckState] = useState<Card[]>(loadDeck);
  const [studying, setStudying] = useState(false);
  const [loadingTopic, setLoadingTopic] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const due = dueCards(deck);

  const setDeck = (d: Card[]) => {
    setDeckState(d);
    onDeckChange();
  };

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  async function fetchTopic(id: string) {
    const t = WORD_TOPICS.find((x) => x.id === id)!;
    setLoadingTopic(id);
    try {
      const res = await getWords({
        learner: { name: profile.name, level: profile.level, goal: profile.goal },
        topic: t.topic,
        known: deck.map((c) => c.word),
      });
      const { deck: next, added } = addWords(res.words, t.titleKo);
      setDeck(next);
      flash(added ? `${t.titleKo} 단어 ${added}개를 담았어요` : "새로 담을 단어가 없었어요");
    } catch (e) {
      flash(e instanceof Error ? e.message : "단어를 불러오지 못했어요");
    } finally {
      setLoadingTopic(null);
    }
  }

  if (studying)
    return (
      <Study
        profile={profile}
        cards={due.slice(0, STUDY_LIMIT)}
        onGrade={(word, known) => setDeck(gradeCard(word, known))}
        onExit={() => setStudying(false)}
      />
    );

  const mastered = deck.filter((c) => c.box === MAX_BOX).length;

  return (
    <div className="screen with-tabs words">
      <header className="tab-head">
        <h1>단어장</h1>
        <p className="muted small">대화에서 배운 표현이 자동으로 쌓여요</p>
      </header>

      <section className="review-card">
        <div>
          <span className="muted small">오늘 복습할 단어</span>
          <b>{due.length}개</b>
          <span className="muted small">
            전체 {deck.length} · 외운 단어 {mastered}
          </span>
        </div>
        <button className="btn primary" disabled={due.length === 0} onClick={() => setStudying(true)}>
          {due.length ? "복습 시작" : "복습 완료"}
        </button>
      </section>

      <h3 className="section-title">추천 단어 받기</h3>
      <div className="chips">
        {WORD_TOPICS.map((t) => (
          <button key={t.id} className="chip" disabled={loadingTopic !== null} onClick={() => fetchTopic(t.id)}>
            {loadingTopic === t.id ? "불러오는 중…" : `+ ${t.titleKo}`}
          </button>
        ))}
      </div>

      <h3 className="section-title">내 단어 {deck.length}개</h3>
      {deck.length === 0 ? (
        <p className="empty muted">
          아직 단어가 없어요. 대화를 마치면 오늘의 표현이 여기에 담기고, 위에서 주제별 단어도 받을 수 있어요.
        </p>
      ) : (
        <ul className="word-list">
          {deck.map((c) => (
            <li key={c.word}>
              <div className="word-txt">
                <strong>{c.word}</strong>
                <span className="muted small">{c.meaning_ko}</span>
              </div>
              <span className="boxes" title={`암기 단계 ${c.box}/${MAX_BOX}`} aria-label={`암기 단계 ${c.box}/${MAX_BOX}`}>
                {Array.from({ length: MAX_BOX }, (_, i) => (
                  <i key={i} className={i < c.box ? "on" : ""} />
                ))}
              </span>
              <button className="icon-btn" aria-label={`${c.word} 삭제`} onClick={() => setDeck(removeCard(c.word))}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Study({ profile, cards, onGrade, onExit }: { profile: Profile; cards: Card[]; onGrade: (word: string, known: boolean) => void; onExit: () => void }) {
  const tutor = findTutor(profile.tutorId);
  const [queue, setQueue] = useState(cards);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [retried] = useState(() => new Set<string>());
  const [pronText, setPronText] = useState<string | null>(null);
  const card = queue[idx];

  useEffect(() => {
    if (card && profile.autoplay) speak(card.word, tutor, profile.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, queue.length]);
  useEffect(() => stopSpeaking, []);

  function grade(ok: boolean) {
    onGrade(card.word, ok);
    if (ok) setKnown((k) => k + 1);
    // 모르는 카드는 이번 복습 끝에 한 번 더 보여준다.
    else if (!retried.has(card.word)) {
      retried.add(card.word);
      setQueue((q) => [...q, card]);
    }
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  const done = idx >= queue.length;

  return (
    <div className="screen study">
      <header className="sub-head">
        <button className="icon-btn" onClick={onExit} aria-label="닫기">
          <Icon name="close" />
        </button>
        <div className="progress">
          <div style={{ width: `${(Math.min(idx, queue.length) / queue.length) * 100}%` }} />
        </div>
        <span className="muted small">
          {Math.min(idx + 1, queue.length)}/{queue.length}
        </span>
      </header>

      {done ? (
        <div className="result-block">
          <div className="result-ring great">
            <b>{known}</b>
            <span>개 기억</span>
          </div>
          <h2>오늘 복습 끝!</h2>
          <p className="muted">맞힌 단어는 다음 복습까지 간격이 늘어나요.</p>
          <div className="result-actions">
            <button className="btn primary big" onClick={onExit}>
              단어장으로
            </button>
          </div>
        </div>
      ) : (
        <>
          <button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-label="카드 뒤집기">
            <span className="fc-inner">
              <span className="fc-face fc-front">
                <strong>{card.word}</strong>
                <span className="muted small">눌러서 뜻 보기</span>
              </span>
              <span className="fc-face fc-back">
                <strong>{card.meaning_ko}</strong>
                <span className="fc-example">{card.example}</span>
                <span className="muted small">{card.source}</span>
              </span>
            </span>
          </button>
          <div className="study-tools">
            <button className="side-btn" onClick={() => speak(card.word, tutor, profile.level)}>
              <Icon name="speaker" />
              <span>단어 듣기</span>
            </button>
            <button className="side-btn" onClick={() => speak(card.example, tutor, profile.level)}>
              <Icon name="speaker" />
              <span>예문 듣기</span>
            </button>
            <button className="side-btn" onClick={() => (stopSpeaking(), setPronText(card.example))}>
              <Icon name="mic" />
              <span>따라 말하기</span>
            </button>
          </div>
          <PronounceSheet text={pronText} tutor={tutor} level={profile.level} onClose={() => setPronText(null)} />
          <div className="grade-row">
            <button className="btn big grade-no" onClick={() => grade(false)}>
              몰라요
            </button>
            <button className="btn big grade-yes" onClick={() => grade(true)}>
              알아요
            </button>
          </div>
        </>
      )}
    </div>
  );
}
