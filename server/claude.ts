import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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

// 분류성 정책 거절 시 서버가 다른 모델로 재실행한다(헤더와 "default" 형태는 짝이 맞아야 400 안 남).
const FALLBACK: Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

const client = new Anthropic();

export class RefusedError extends Error {}

function firstText(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// 튜터 응답을 텍스트 조각 단위로 흘려준다.
export async function streamChat(req: ChatRequest, onText: (delta: string) => void): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: KICKOFF },
    ...req.history.map((t) => ({ role: t.role, content: t.text })),
  ];
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low" }, // 대화는 짧고 지연이 중요하다
    system: tutorSystem(req.tutorId, req.scenarioId, req.learner),
    messages,
  });
  stream.on("text", onText);
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new RefusedError("refused");
  return firstText(final.content);
}

async function parse<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  effort: "low" | "medium",
): Promise<z.infer<T>> {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new RefusedError("refused");
  if (!res.parsed_output) throw new Error(`unparseable output (stop_reason=${res.stop_reason})`);
  return res.parsed_output;
}

const FeedbackSchema = z.object({
  verdict: z.enum(["perfect", "minor", "error"]),
  corrected: z.string(),
  natural_alternative: z.string(),
  explanation_ko: z.string(),
  score: z.number().int(),
});

export function feedback(req: FeedbackRequest): Promise<Feedback> {
  return parse(
    FeedbackSchema,
    feedbackSystem(req.learner),
    `Tutor said: ${req.tutorLine || "(nothing yet)"}\nLearner replied: ${req.userLine}`,
    "low",
  );
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

export async function translate(text: string): Promise<string> {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low" },
    system: TRANSLATE_SYSTEM,
    messages: [{ role: "user", content: text }],
  });
  if (res.stop_reason === "refusal") throw new RefusedError("refused");
  return firstText(res.content);
}
