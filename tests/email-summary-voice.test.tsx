// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceDraftPrompt } from "../src/components/email-summary/VoiceDraftPrompt";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("mock draft voice prompt", () => {
  it("asks for a message, then transcribes it for the draft", () => {
    class FakeRecognition {
      static latest: FakeRecognition | null = null;
      lang = "";
      continuous = false;
      interimResults = false;
      onresult:
        | ((event: {
            results: ArrayLike<ArrayLike<{ transcript: string }>>;
          }) => void)
        | null = null;
      onerror = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        FakeRecognition.latest = this;
      }
    }
    class FakeUtterance {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const speak = vi.fn((utterance: FakeUtterance) => utterance.onend?.());
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("speechSynthesis", { speak });
    const onMessage = vi.fn();

    render(<VoiceDraftPrompt onMessage={onMessage} />);
    act(() =>
      fireEvent.click(
        screen.getByRole("button", { name: "Ask Samantha to draft by voice" }),
      ),
    );
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "What message would you like me to draft?",
      }),
    );
    expect(FakeRecognition.latest?.start).toHaveBeenCalledOnce();
    act(() =>
      FakeRecognition.latest?.onresult?.({
        results: [
          [{ transcript: "Tell the staff I'm running 20 minutes late" }],
        ],
      }),
    );
    expect(onMessage).toHaveBeenCalledWith(
      "Tell the staff I'm running 20 minutes late",
    );
  });

  it("offers typing when neither speech recognition nor recording is available", () => {
    render(<VoiceDraftPrompt onMessage={vi.fn()} />);
    expect(screen.getByText(/Voice input needs a microphone/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Ask Samantha to draft by voice",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("records a short message for transcription when Firefox has no SpeechRecognition", async () => {
    class FakeRecorder {
      state = "inactive";
      mimeType = "audio/ogg";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["x".repeat(600)], { type: "audio/ogg" }),
        });
        this.onstop?.();
      }
    }
    class FakeUtterance {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const fetchMock = vi.fn(async () =>
      Response.json({ text: "Tell the staff I'm running late" }),
    );
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("speechSynthesis", {
      speak: (prompt: FakeUtterance) => prompt.onend?.(),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      language: "en-US",
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    const onMessage = vi.fn();

    render(<VoiceDraftPrompt onMessage={onMessage} />);
    expect(await screen.findByText(/short recording to Gemini/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Ask Samantha to draft by voice" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Stop listening" }),
    );
    await waitFor(() =>
      expect(onMessage).toHaveBeenCalledWith("Tell the staff I'm running late"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/email-summary/transcribe",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
