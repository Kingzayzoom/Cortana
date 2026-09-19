import { describe, expect, it } from "vitest";
import { VoiceTranscript } from "../src/lib/voice/transcript";
import { voiceErrorMessage } from "../src/lib/voice/errors";
describe("final voice transcript", () => {
  it("deduplicates provider events and applies an interruption correction in place", () => {
    const transcript = new VoiceTranscript("conv_test");
    const event = {
      role: "agent" as const,
      source: "ai" as const,
      message: "The study included adults",
      event_id: 1,
    };
    transcript.received(event);
    expect(transcript.received(event)).toHaveLength(1);
    expect(transcript.corrected(1, "The study included…")).toEqual([
      {
        id: "conv_test-assistant-1",
        role: "assistant",
        text: "The study included…",
      },
    ]);
  });
  it("preserves an actual typed answer as one row when the provider echoes it", () => {
    const transcript = new VoiceTranscript("conv_test");
    transcript.sent("I selected B. Please call submit_answer.", "B");
    const echo = {
      role: "user" as const,
      source: "user" as const,
      message: "I selected B. Please call submit_answer.",
      event_id: 9,
    };
    transcript.received(echo);
    expect(transcript.received(echo)).toMatchObject([
      { role: "user", text: "B" },
    ]);
  });
  it("keeps user and agent event IDs separate and preserves repeated spoken words", () => {
    const transcript = new VoiceTranscript("conv_test");
    transcript.received({
      role: "agent",
      source: "ai",
      message: "Yes",
      event_id: 1,
    });
    transcript.received({
      role: "user",
      source: "user",
      message: "Yes",
      event_id: 1,
    });
    expect(
      transcript.received({
        role: "user",
        source: "user",
        message: "Yes",
        event_id: 2,
      }),
    ).toHaveLength(3);
  });
});
it.each([
  ["NotAllowedError", "denied"],
  ["NotFoundError", "No microphone"],
  ["token expired", "expired"],
  ["network disconnected", "network"],
  ["403 forbidden", "denied"],
  ["quota exceeded", "billing"],
  ["timeout", "timed out"],
  ["NotReadableError", "unavailable"],
])("explains SDK failure %s", (error, expected) => {
  expect(voiceErrorMessage(error)).toContain(expected);
});
