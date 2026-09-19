import type { HookCallbacks } from "@elevenlabs/react";
import type { Message } from "../learning/types";

/** In-memory final events only. A typed message and its server echo share one row. */
export class VoiceTranscript {
  private messages: Message[] = [];
  private pending: { wireText: string; message: Message }[] = [];
  private eventIds = new Map<string, string>();
  constructor(private session: string) {}
  private upsert(message: Message) {
    const exists = this.messages.some((entry) => entry.id === message.id);
    this.messages = exists
      ? this.messages.map((entry) =>
          entry.id === message.id ? message : entry,
        )
      : [...this.messages, message].slice(-100);
    return this.messages;
  }
  sent(wireText: string, displayText = wireText) {
    const message: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: displayText,
    };
    this.pending.push({ wireText, message });
    this.pending = this.pending.slice(-100);
    return this.upsert(message);
  }
  received(event: Parameters<NonNullable<HookCallbacks["onMessage"]>>[0]) {
    const role = event.role === "user" ? "user" : "assistant";
    const key = `${this.session}-${role}-${event.event_id ?? crypto.randomUUID()}`;
    const knownId = this.eventIds.get(key);
    if (knownId) return this.messages;
    const pendingIndex =
      role === "user"
        ? this.pending.findIndex((entry) => entry.wireText === event.message)
        : -1;
    if (pendingIndex >= 0) {
      const [{ message }] = this.pending.splice(pendingIndex, 1);
      this.eventIds.set(key, message.id);
      return this.upsert(message);
    }
    this.eventIds.set(key, key);
    return this.upsert({ id: key, role, text: event.message });
  }
  corrected(eventId: number, text: string) {
    const key = `${this.session}-assistant-${eventId}`;
    this.eventIds.set(key, key);
    return this.upsert({ id: key, role: "assistant", text });
  }
}
