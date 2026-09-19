export type LessonStage =
  "ready" | "briefing" | "challenge" | "feedback" | "questions" | "completed";
export type ConnectionState =
  "idle" | "connecting" | "connected" | "disconnecting" | "error";
export type VoiceActivity =
  "quiet" | "user-speaking" | "assistant-speaking" | "awaiting-response";
export type Grade = {
  verdict: "correct" | "incorrect" | "clarify";
  answerId?: string;
  explanation: string;
  takeaway: string;
  sourceIds: string[];
};
export type Preferences = {
  name: string;
  timezone: string;
  reducedMotion: boolean;
  transcript: boolean;
};
export type Attempt = {
  id: string;
  roundId: string;
  version: string;
  answerId: string;
  correct: boolean;
  at: string;
};
export type Completion = {
  roundId: string;
  at: string;
  date: string;
  xp: number;
  version: string;
};
export type Run = {
  mode?: "voice" | "preview";
  id: string;
  stage: LessonStage;
  section: number;
  grade: Grade | null;
  completed: boolean;
};
export type Progress = {
  learningSignals?: import("../learning-signals/types").LearningSignal[];
  preferences: Preferences;
  attempts: Attempt[];
  completions: Completion[];
  practiceDays: string[];
  run: Run | null;
  review: { date: string; reason: string } | null;
};
export type Snapshot = Progress & {
  xp: number;
  streak: number;
  voiceConfigured: boolean;
  storage: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  preview?: boolean;
};
