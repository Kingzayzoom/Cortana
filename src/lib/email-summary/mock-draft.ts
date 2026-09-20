import type { EmailDraft } from "./types";

function greeting(recipient: string) {
  const name = recipient.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return "Hello,";
  if (/\b(staff|team)\b/i.test(name)) return "Hi team,";
  return `Hi ${name},`;
}

export function makeMockEmailDraft(request: string, recipient = ""): EmailDraft {
  const message = request.trim().replace(/\s+/g, " ").slice(0, 1600);
  const hello = greeting(recipient || (/\b(staff|team)\b/i.test(message) ? "team" : ""));

  if (/\b(late|running behind|behind schedule)\b/i.test(message)) {
    const duration = message.match(/\b(?:about\s+)?\d+\s*(?:minutes?|mins?|hours?)\b/i)?.[0];
    return {
      subject: "Running Late",
      body: `${hello}\n\nI wanted to let you know that I'm running ${duration ? `${duration} ` : ""}late. I'll share an updated arrival time as soon as I can.\n\nThank you for your understanding.`,
    };
  }

  if (/\b(follow[ -]?up|checking in|check in)\b/i.test(message)) {
    const topic = message.match(/\babout\s+([^.!?]+)/i)?.[1]?.trim();
    return {
      subject: "Following Up",
      body: `${hello}\n\nI'm following up${topic ? ` about ${topic}` : ""} to see if you have any updates when you have a chance. Please let me know if there's anything you need from me.\n\nThank you.`,
    };
  }

  const detail = message.match(/\b(?:that|saying|to say)\s+(.+)$/i)?.[1]
    ?? message.match(/\b(?:I am|I'm|we are|we're)\b.+$/i)?.[0]
    ?? message;
  const sentence = detail.charAt(0).toUpperCase() + detail.slice(1);
  return {
    subject: "Quick Message",
    body: `${hello}\n\n${sentence}${/[.!?]$/.test(sentence) ? "" : "."}\n\nThank you.`,
  };
}
