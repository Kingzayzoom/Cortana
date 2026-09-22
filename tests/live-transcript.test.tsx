// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LiveConversationPanel } from "../src/components/voice/LiveConversationPanel";
import type { Message } from "../src/lib/learning/types";

const state = vi.hoisted(() => ({
  voice: {
    messages: [] as Message[],
    connection: "connected",
    activity: "quiet",
    preview: false,
    paused: false,
    send: vi.fn(),
  },
  learning: {
    data: {
      run: { id: "one", stage: "briefing", section: 0, completed: false },
      preferences: { reducedMotion: true },
    },
    act: vi.fn(),
    addMessage: vi.fn(),
    openEvidence: vi.fn(),
    busy: false,
  },
}));
vi.mock("../src/lib/voice/provider", () => ({ useVoice: () => state.voice }));
vi.mock("../src/lib/learning/provider", () => ({
  useLearning: () => state.learning,
}));
const scroll = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  state.voice.messages = [
    { id: "first", role: "assistant", text: "Who was studied?" },
  ];
  state.voice.activity = "quiet";
  state.learning.data.run.stage = "briefing";
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scroll,
  });
});
afterEach(cleanup);

it("renders actual turns and applies a correction without adding a duplicate", () => {
  const view = render(<LiveConversationPanel active />);
  expect(screen.getAllByText("Samantha")).toHaveLength(1);
  state.voice.messages = [
    { id: "first", role: "assistant", text: "The trial included adults." },
  ];
  view.rerender(<LiveConversationPanel active />);
  expect(screen.queryByText("Who was studied?")).toBeNull();
  expect(screen.getAllByText("The trial included adults.")).toHaveLength(1);
  expect(screen.queryByText("Round progress")).toBeNull();
});

it("keeps the challenge between its preceding and following turns after grading", () => {
  const view = render(<LiveConversationPanel active />);
  state.learning.data.run.stage = "challenge";
  view.rerender(<LiveConversationPanel active />);
  state.voice.messages = [
    ...state.voice.messages,
    { id: "answer", role: "user", text: "B" },
  ];
  state.learning.data.run.stage = "feedback";
  view.rerender(<LiveConversationPanel active />);
  const log = screen.getByRole("log");
  const entries = Array.from(log.children);
  expect(entries[0].textContent).toContain("Who was studied?");
  expect(entries[1].textContent).toContain("Synthetic clinical challenge");
  expect(entries[2].textContent).toBe("YouB");
  expect(
    screen
      .getByRole("region", { name: "Synthetic clinical challenge" })
      .querySelector("button")?.disabled,
  ).toBe(true);
});

it("does not force a reader back down, and Jump to live resumes following", () => {
  const view = render(<LiveConversationPanel active />);
  const log = screen.getByRole("log");
  Object.defineProperties(log, {
    scrollHeight: { configurable: true, value: 1200 },
    clientHeight: { configurable: true, value: 400 },
    scrollTop: { configurable: true, writable: true, value: 100 },
  });
  fireEvent.scroll(log);
  scroll.mockClear();
  state.voice.messages = [
    ...state.voice.messages,
    { id: "next", role: "assistant", text: "More evidence." },
  ];
  view.rerender(<LiveConversationPanel active />);
  expect(scroll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Jump to live" }));
  expect(scroll).toHaveBeenCalledWith({ top: 1200, behavior: "instant" });
});
