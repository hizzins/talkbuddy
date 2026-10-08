import type {
  ChatRequest,
  Feedback,
  FeedbackRequest,
  Hint,
  HintRequest,
  Lesson,
  LessonRequest,
  Summary,
  SummaryRequest,
  WordsRequest,
  WordsResponse,
} from "../../shared/types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export const getFeedback = (b: FeedbackRequest) => post<Feedback>("/api/feedback", b);
export const getHint = (b: HintRequest) => post<Hint>("/api/hint", b);
export const getSummary = (b: SummaryRequest) => post<Summary>("/api/summary", b);
// 같은 레슨 생성 요청이 겹치면(StrictMode 이중 effect, 빠른 재진입) 한 번만 보낸다 — 생성은 비싸다.
const lessonInFlight = new Map<string, Promise<Lesson>>();
export function getLesson(b: LessonRequest): Promise<Lesson> {
  const key = `${b.lessonId}:${b.learner.level}`;
  let p = lessonInFlight.get(key);
  if (!p) {
    p = post<Lesson>("/api/lesson", b).finally(() => lessonInFlight.delete(key));
    lessonInFlight.set(key, p);
  }
  return p;
}
export const getWords = (b: WordsRequest) => post<WordsResponse>("/api/words", b);
export const translate = (text: string) => post<{ text: string }>("/api/translate", { text }).then((r) => r.text);

export async function getMode(): Promise<"mock" | "live" | "offline"> {
  try {
    const res = await fetch("/api/health");
    return (await res.json()).mode;
  } catch {
    return "offline";
  }
}

// 서버가 SSE(data: {...}) 로 보내는 튜터 응답을 조각마다 콜백한다.
export async function streamChat(
  body: ChatRequest,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`대화 서버에 연결하지 못했어요 (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/^data: /, "");
      buf = buf.slice(idx + 2);
      const evt = JSON.parse(line);
      if (evt.error) throw new Error(evt.error);
      if (evt.delta) onDelta(evt.delta);
      if (evt.done) return evt.text as string;
    }
  }
  throw new Error("응답이 중간에 끊겼어요");
}
