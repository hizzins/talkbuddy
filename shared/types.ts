// 클라이언트·서버가 함께 쓰는 계약. API 요청/응답 모양이 바뀌면 여기부터 고친다.

export type Level = "beginner" | "intermediate" | "advanced";
export type Goal = "daily" | "travel" | "work" | "exam" | "confidence";

export interface Learner {
  name: string;
  level: Level;
  goal: Goal;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatRequest {
  tutorId: string;
  scenarioId: string;
  learner: Learner;
  history: Turn[]; // 비어 있으면 튜터가 먼저 말을 건다
}

export interface FeedbackRequest {
  learner: Learner;
  tutorLine: string; // 학습자가 대답한 직전 튜터 발화(문맥)
  userLine: string;
}

export interface Feedback {
  verdict: "perfect" | "minor" | "error";
  corrected: string;
  natural_alternative: string;
  explanation_ko: string;
  score: number;
}

export interface HintRequest {
  learner: Learner;
  scenarioId: string;
  history: Turn[];
}

export interface Hint {
  suggestions: { en: string; ko: string }[];
}

export interface TranslateRequest {
  text: string;
}

export interface SummaryRequest {
  learner: Learner;
  scenarioId: string;
  history: Turn[];
  feedback: { userLine: string; feedback: Feedback }[];
}

export interface Summary {
  overall_ko: string;
  strengths_ko: string[];
  focus_ko: string[];
  vocabulary: { word: string; meaning_ko: string; example: string }[];
}

// ---------- 문법 레슨 ----------

export interface LessonRequest {
  learner: Learner;
  lessonId: string;
}

export interface QuizItem {
  question: string; // 빈칸은 ___ 로 표시
  options: string[]; // 4개
  answer_index: number;
  explanation_ko: string;
}

export interface Lesson {
  intro_ko: string;
  points: { rule_ko: string; example_en: string; example_ko: string }[];
  tip_ko: string;
  quiz: QuizItem[];
}

// ---------- 어휘 ----------

export interface Word {
  word: string;
  meaning_ko: string;
  example: string;
}

export interface WordsRequest {
  learner: Learner;
  topic: string; // 영어 주제 설명
  known: string[]; // 이미 단어장에 있는 단어(중복 방지)
}

export interface WordsResponse {
  words: Word[];
}
