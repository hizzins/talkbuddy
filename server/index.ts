import Anthropic from "@anthropic-ai/sdk";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type {
  ChatRequest,
  FeedbackRequest,
  HintRequest,
  LessonRequest,
  SummaryRequest,
  TranslateRequest,
  WordsRequest,
} from "../shared/types.js";
import { RefusedError, feedback, hint, lesson, streamChat, summary, translate, words } from "./claude.js";
import { mockChat, mockFeedback, mockHint, mockLesson, mockSummary, mockTranslate, mockWords } from "./mock.js";

const PORT = Number(process.env.PORT ?? 8787);
const MOCK =
  process.env.MOCK === "1" || (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN);
const MAX_BODY = 256 * 1024;

async function readJson<T>(req: IncomingMessage): Promise<T> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "요청이 너무 큽니다");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

// SDK 오류를 사용자에게 보여줄 상태·문구로 바꾼다(구체적인 것부터).
function toHttp(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof RefusedError) return new HttpError(422, "이 내용에는 답할 수 없어요. 다른 주제로 이야기해 볼까요?");
  if (err instanceof Anthropic.AuthenticationError) return new HttpError(401, "API 키가 올바르지 않습니다(.env 확인)");
  if (err instanceof Anthropic.RateLimitError) return new HttpError(429, "요청이 많아요. 잠시 후 다시 시도해 주세요");
  if (err instanceof Anthropic.APIError) return new HttpError(502, `AI 서버 오류 (${err.status ?? "network"})`);
  if (err instanceof SyntaxError) return new HttpError(400, "잘못된 요청 형식");
  return new HttpError(500, err instanceof Error ? err.message : "알 수 없는 오류");
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson<ChatRequest>(req);
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    if (MOCK) {
      const text = mockChat(body);
      for (const word of text.split(/(?<= )/)) {
        send({ delta: word });
        await new Promise((r) => setTimeout(r, 40));
      }
      send({ done: true, text });
    } else {
      const text = await streamChat(body, (delta) => send({ delta }));
      send({ done: true, text });
    }
  } catch (err) {
    const e = toHttp(err);
    console.error("[chat]", err);
    send({ error: e.message, status: e.status });
  }
  res.end();
}

const routes: Record<string, (req: IncomingMessage) => Promise<unknown>> = {
  "/api/feedback": async (req) => {
    const b = await readJson<FeedbackRequest>(req);
    return MOCK ? mockFeedback(b) : feedback(b);
  },
  "/api/hint": async (req) => {
    const b = await readJson<HintRequest>(req);
    return MOCK ? mockHint() : hint(b);
  },
  "/api/translate": async (req) => {
    const b = await readJson<TranslateRequest>(req);
    return { text: MOCK ? mockTranslate(b.text) : await translate(b.text) };
  },
  "/api/summary": async (req) => {
    const b = await readJson<SummaryRequest>(req);
    return MOCK ? mockSummary() : summary(b);
  },
  "/api/lesson": async (req) => {
    const b = await readJson<LessonRequest>(req);
    return MOCK ? mockLesson(b.lessonId) : lesson(b);
  },
  "/api/words": async (req) => {
    const b = await readJson<WordsRequest>(req);
    return MOCK ? mockWords(b.topic) : words(b);
  },
};

createServer(async (req, res) => {
  const path = (req.url ?? "").split("?")[0];
  try {
    if (req.method === "GET" && path === "/api/health") return sendJson(res, 200, { mode: MOCK ? "mock" : "live" });
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    if (path === "/api/chat") return await handleChat(req, res);
    const route = routes[path];
    if (!route) throw new HttpError(404, "not found");
    sendJson(res, 200, await route(req));
  } catch (err) {
    const e = toHttp(err);
    if (e.status >= 500) console.error(`[${path}]`, err);
    if (!res.headersSent) sendJson(res, e.status, { error: e.message });
    else res.end();
  }
}).listen(PORT, () => {
  console.log(`TalkBuddy API on :${PORT} (${MOCK ? "MOCK — API 키 없음" : "live"})`);
});
