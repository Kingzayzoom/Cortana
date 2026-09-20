import { describe, expect, it } from "vitest";
import { sourceFromGmailMessage } from "../src/lib/server/email-summary/gmail";
import { summaryDate } from "../src/lib/server/email-summary/gemini";
import { makeMockEmailDraft } from "../src/lib/email-summary/mock-draft";

const now = Date.UTC(2026, 8, 19, 12);
const message = {
  labelIds: ["INBOX"],
  snippet: " Please   review  this request. ",
  internalDate: String(now - 60 * 60 * 1000),
  payload: { headers: [
    { name: "From", value: "Dr. Smith <smith@example.com>" },
    { name: "Subject", value: "  Friday   meeting " },
  ] },
};

describe("Gmail morning briefing input", () => {
  it("keeps only compact metadata from a recent inbox message", () => {
    expect(sourceFromGmailMessage(message, now)).toEqual({
      sender: "Dr. Smith <smith@example.com>",
      subject: "Friday meeting",
      snippet: "Please review this request.",
      date: new Date(now - 60 * 60 * 1000).toISOString(),
    });
  });

  it("excludes non-inbox, spam, promotions, social, trash, and newsletters", () => {
    expect(sourceFromGmailMessage({ ...message, labelIds: [] }, now)).toBeNull();
    for (const label of ["SPAM", "TRASH", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"]) {
      expect(sourceFromGmailMessage({ ...message, labelIds: ["INBOX", label] }, now)).toBeNull();
    }
    expect(sourceFromGmailMessage({
      ...message,
      payload: { headers: [...message.payload.headers,
        { name: "List-Unsubscribe", value: "<mailto:leave@example.com>" }] },
    }, now)).toBeNull();
    expect(sourceFromGmailMessage({
      ...message,
      payload: { headers: [{ name: "Subject", value: "Weekly newsletter" }] },
    }, now)).toBeNull();
  });

  it("rejects messages older than the recent inbox window", () => {
    expect(sourceFromGmailMessage({
      ...message, internalDate: String(now - 31 * 60 * 60 * 1000),
    }, now)).toBeNull();
  });

  it("uses Eastern calendar dates for the daily run", () => {
    expect(summaryDate(new Date("2026-09-19T02:00:00Z"))).toBe("2026-09-18");
    expect(summaryDate(new Date("2026-01-19T13:00:00Z"))).toBe("2026-01-19");
  });
});

describe("mock email drafts", () => {
  it("uses the spoken delay in a sample staff update", () => {
    const draft = makeMockEmailDraft("Tell the staff I'm running 20 minutes late", "clinic staff");
    expect(draft.subject).toBe("Running Late");
    expect(draft.body).toContain("Hi team,");
    expect(draft.body).toContain("20 minutes late");
  });

  it("creates a sample colleague follow-up without accessing Gmail", () => {
    const draft = makeMockEmailDraft("Follow up with my colleague", "Dr. Lee");
    expect(draft.subject).toBe("Following Up");
    expect(draft.body).toContain("Hi Dr. Lee,");
  });
});
