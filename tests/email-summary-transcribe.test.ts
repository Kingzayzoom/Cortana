import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/email-summary/transcribe/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Firefox voice transcription route", () => {
  it("sends a short audio clip to Gemini and returns only the transcript", async () => {
    vi.stubEnv("CORTANA_APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const gemini = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: '{"transcript":"Tell staff I am running late"}' },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", gemini);
    const form = new FormData();
    form.append(
      "audio",
      new Blob(["a".repeat(600)], { type: "audio/ogg" }),
      "voice.ogg",
    );
    const response = await POST(
      new Request("http://localhost:3000/api/email-summary/transcribe", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: "Tell staff I am running late",
    });
    expect(gemini).toHaveBeenCalledOnce();
    const [url, options] = gemini.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("gemini-3.5-flash:generateContent");
    const body = JSON.parse(String(options.body));
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("audio/ogg");
    expect(
      Buffer.from(body.contents[0].parts[1].inlineData.data, "base64").length,
    ).toBe(600);
  });
});
