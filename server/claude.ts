import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
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
} from "../shared/types.js";
import { findLesson } from "../shared/catalog.js";
import {
  KICKOFF,
  TRANSLATE_SYSTEM,
  feedbackSystem,
  hintSystem,
  lessonSystem,
  lessonUser,
  summarySystem,
  wordsSystem,
  transcript,
  tutorSystem,
} from "./prompts.js";

const MODEL = process.env.TALKBUDDY_MODEL ?? "claude-opus-5-5";

// 같은 Anthropic SDK 로 두 제공자를 부른다.
// - Claude: beta 경로 + 서버측 fallback(거절 시 다른 Claude 모델로 재실행)
// - 그 외(Kimi 등 Anthropic 호환 엔드포인트, ANTHROPIC_BASE_URL 로 지정): 일반 경로.
//   beta 경로는 URL 에 ?beta=true 를 붙이고 fallbacks·betas 는 Claude 전용이라 보내지 않는다.
const IS_CLAUDE = MODEL.startsWith("claude-");

// 분류성 정책 거절 시 서버가 다른 모델로 재실행한다(헤더와 "default" 형태는 짝이 맞아야 400 안 남).
const FALLBACK: Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

type Effort = "low" | "medium" | "high";
// Kimi 의 effort 는 low/high/max 뿐이라 medium 은 high 로 올린다.
const effortFor = (e: Effort): Effort => (IS_CLAUDE || e !== "medium" ? e : "high");

const client = new Anthropic();

export function providerInfo() {
  return { model: MODEL, provider: IS_CLAUDE ? "anthropic" : "anthropic-compatible", baseURL: client.baseURL };
}

export class RefusedError extends Error {}

// 호출마다 토큰·소요시간을 한 줄 남긴다(비용·지연 측정용).
function logUsage(kind: string, started: number, usage: { input_tokens: number; output_tokens: number } | null | undefined) {
  const ms = Date.now() - started;
  console.log(`[usage] ${kind.padEnd(8)} ${MODEL} in=${usage?.input_tokens ?? "?"} out=${usage?.output_tokens ?? "?"} ${ms}ms`);
}

function firstText(content: (Anthropic.ContentBlock | Anthropic.Beta.BetaContentBlock)[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock | Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

interface TextParams {
  system: string;
  messages: Anthropic.MessageParam[];
  effort: Effort;
  max_tokens: number;
}

function baseParams(p: TextParams) {
  return {
    model: MODEL,
    max_tokens: p.max_tokens,
    output_config: { effort: effortFor(p.effort) },
    system: p.system,
    messages: p.messages,
  };
}

async function streamText(p: TextParams, onText: (delta: string) => void): Promise<string> {
  const started = Date.now();
  let final: Anthropic.Message | Anthropic.Beta.BetaMessage;
  if (IS_CLAUDE) {
    const stream = client.beta.messages.stream({ ...baseParams(p), ...FALLBACK });
    stream.on("text", onText);
    final = await stream.finalMessage();
  } else {
    const stream = client.messages.stream(baseParams(p));
    stream.on("text", onText);
    final = await stream.finalMessage();
  }
  logUsage("chat", started, final.usage);
  if (final.stop_reason === "refusal") throw new RefusedError("refused");
  return firstText(final.content);
}

async function createText(p: TextParams): Promise<string> {
  const started = Date.now();
  const res = IS_CLAUDE
    ? await client.beta.messages.create({ ...baseParams(p), ...FALLBACK })
    : await client.messages.create(baseParams(p));
  logUsage("text", started, res.usage);
  if (res.stop_reason === "refusal") throw new RefusedError("refused");
  return firstText(res.content);
}

async function parse<T extends z.ZodType>(schema: T, system: string, user: string, effort: Effort): Promise<z.infer<T>> {
  const started = Date.now();
  const p = baseParams({ system, messages: [{ role: "user", content: user }], effort, max_tokens: 16000 });
  const res = IS_CLAUDE
    ? await client.beta.messages.parse({ ...p, ...FALLBACK, output_config: { ...p.output_config, format: betaZodOutputFormat(schema) } })
    : await client.messages.parse({ ...p, output_config: { ...p.output_config, format: zodOutputFormat(schema) } });
  logUsage("json", started, res.usage);
  if (res.stop_reason === "refusal") throw new RefusedError("refused");
  if (!res.parsed_output) throw new Error(`unparseable output (stop_reason=${res.stop_reason})`);
  return res.parsed_output as z.infer<T>;
}

// 튜터 응답을 텍스트 조각 단위로 흘려준다.
export function streamChat(req: ChatRequest, onText: (delta: string) => void): Promise<string> {
  return streamText(
    {
      system: tutorSystem(req.tutorId, req.scenarioId, req.learner),
      messages: [{ role: "user", content: KICKOFF }, ...req.history.map((t) => ({ role: t.role, content: t.text }))],
      effort: "low", // 대화는 짧고 지연이 중요하다
      max_tokens: 4000,
    },
    onText,
  );
}

// verdict 는 enum 이 아니라 문자열로 받는다: SDK 는 enum 을 JSON 스키마가 아닌 description 으로만 전달하므로,
// 제약 디코딩을 하지 않는 모델(Kimi 등)이 "Perfect" 처럼 살짝 다르게 쓰면 파싱 전체가 실패한다.
const FeedbackSchema = z.object({
  verdict: z.string().describe('one of "perfect", "minor", "error"'),
  corrected: z.string(),
  natural_alternative: z.string(),
  explanation_ko: z.string(),
  score: z.number().int(),
});

const VERDICTS: Feedback["verdict"][] = ["perfect", "minor", "error"];

export async function feedback(req: FeedbackRequest): Promise<Feedback> {
  const out = await parse(
    FeedbackSchema,
    feedbackSystem(req.learner),
    `Tutor said: ${req.tutorLine || "(nothing yet)"}\nLearner replied: ${req.userLine}`,
    "low",
  );
  const v = out.verdict.trim().toLowerCase() as Feedback["verdict"];
  return {
    ...out,
    verdict: VERDICTS.includes(v) ? v : "minor",
    score: Math.max(0, Math.min(100, Math.round(out.score))),
  };
}

const HintSchema = z.object({
  suggestions: z.array(z.object({ en: z.string(), ko: z.string() })),
});

export function hint(req: HintRequest): Promise<Hint> {
  return parse(HintSchema, hintSystem(req.scenarioId, req.learner), transcript(req.history), "low");
}

const SummarySchema = z.object({
  overall_ko: z.string(),
  strengths_ko: z.array(z.string()),
  focus_ko: z.array(z.string()),
  vocabulary: z.array(z.object({ word: z.string(), meaning_ko: z.string(), example: z.string() })),
});

export function summary(req: SummaryRequest): Promise<Summary> {
  const notes = req.feedback
    .filter((f) => f.feedback.verdict !== "perfect")
    .map((f) => `- "${f.userLine}" -> "${f.feedback.corrected}"`)
    .join("\n");
  return parse(
    SummarySchema,
    summarySystem(req.scenarioId, req.learner),
    `Conversation:\n${transcript(req.history)}\n\nCorrections found during the session:\n${notes || "(none)"}`,
    "medium",
  );
}

const LessonSchema = z.object({
  intro_ko: z.string(),
  points: z.array(z.object({ rule_ko: z.string(), example_en: z.string(), example_ko: z.string() })),
  tip_ko: z.string(),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      answer_index: z.number().int(),
      explanation_ko: z.string(),
    }),
  ),
});

export async function lesson(req: LessonRequest): Promise<Lesson> {
  const def = findLesson(req.lessonId);
  if (!def) throw new Error(`unknown lesson ${req.lessonId}`);
  const out = await parse(LessonSchema, lessonSystem(req.learner), lessonUser(def.title, def.focus), "medium");
  // 스키마로 표현 못 한 조건(보기 4개, 정답 범위)은 여기서 거른다.
  return { ...out, quiz: out.quiz.filter((q) => q.options.length >= 2 && q.answer_index >= 0 && q.answer_index < q.options.length) };
}

const WordsSchema = z.object({
  words: z.array(z.object({ word: z.string(), meaning_ko: z.string(), example: z.string() })),
});

export function words(req: WordsRequest): Promise<WordsResponse> {
  const known = req.known.slice(0, 200).join(", ");
  return parse(WordsSchema, wordsSystem(req.learner), `Topic: ${req.topic}\nKnown: ${known || "(none)"}`, "low");
}

export function translate(text: string): Promise<string> {
  return createText({ system: TRANSLATE_SYSTEM, messages: [{ role: "user", content: text }], effort: "low", max_tokens: 4000 });
}
