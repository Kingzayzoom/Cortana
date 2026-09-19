import { chromium, expect } from "@playwright/test";
import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const fixtureAudio = process.argv.includes("--fixture-audio");
const headed = process.argv.includes("--headed");
const browser = await chromium.launch({
  headless: !headed,
  args: [
    ...(headed ? ["--window-position=-32000,-32000"] : []),
    ...(fixtureAudio
      ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
      : []),
  ],
});
const context = await browser.newContext({
  permissions: ["microphone"],
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  // Observe the real browser devices and peer connections; never replace audio.
  window.__voiceAudit = {
    tracks: [],
    peers: [],
    samples: [],
    remoteTracks: [],
    events: [],
  };
  const capture = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices,
  );
  navigator.mediaDevices.getUserMedia = async (...args) => {
    try {
      const stream = await capture(...args);
      window.__voiceAudit.tracks.push(...stream.getTracks());
      return stream;
    } catch (error) {
      window.__voiceAudit.microphoneError = {
        name: error.name,
        message: error.message,
      };
      throw error;
    }
  };
  const Peer = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends Peer {
    constructor(...args) {
      super(...args);
      window.__voiceAudit.peers.push(this);
      this.addEventListener("track", (event) =>
        window.__voiceAudit.remoteTracks.push(event.track),
      );
      this.addEventListener("datachannel", (event) => {
        event.channel.addEventListener("message", (message) => {
          // Only event type/size, never token or audio payloads.
          window.__voiceAudit.events.push({
            label: event.channel.label,
            bytes: message.data.byteLength ?? message.data.length,
          });
        });
      });
    }
  };
});
const report = { fakeAudio: fixtureAudio, headed, connected: false, errors };
const actions = [];
page.on("request", (request) => {
  if (request.url().endsWith("/api/learning") && request.method() === "POST") {
    const body = request.postDataJSON();
    actions.push({
      action: body.action,
      stageId: body.stageId,
      sectionId: body.sectionId,
    });
  }
});
try {
  await page.goto(process.env.CORTANA_TEST_URL || "http://localhost:3100");
  await page.getByRole("button", { name: "Start today’s round" }).click();
  await page
    .getByLabel("Demo access code")
    .fill(process.env.CORTANA_DEMO_ACCESS_CODE);
  await page.getByRole("button", { name: "Agree & start voice" }).click();
  await page.locator(".status-live, .status-error").waitFor({ timeout: 35000 });
  if (!(await page.locator(".status-live").count()))
    throw new Error(
      "Live connection was rejected; see the visible error below.",
    );
  report.connected = true;
  report.conversationId = await page
    .locator(".voice-status")
    .getAttribute("data-conversation-id");
  await page
    .getByRole("button", { name: "Show transcript", exact: true })
    .click();
  if (process.argv.includes("--quiet-start"))
    await page
      .getByRole("button", { name: "Mute microphone", exact: true })
      .click();
  // Sample actual input and playback energy independently for the first greeting.
  for (
    let i = 0;
    i < (process.argv.includes("--quiet-start") ? 100 : 45);
    i++
  ) {
    const sample = await page
      .locator('[data-testid="orb"]')
      .evaluate((node) => ({
        input: Number(node.dataset.inputEnergy || 0),
        output: Number(node.dataset.outputEnergy || 0),
      }));
    await page.evaluate(
      (sample) => window.__voiceAudit.samples.push(sample),
      sample,
    );
    await page.waitForTimeout(200);
  }
  report.transcript = await page
    .locator(".transcript-message p")
    .allTextContents();
  report.audio = await page.evaluate(() => ({
    tracks: window.__voiceAudit.tracks.map((track) => ({
      kind: track.kind,
      state: track.readyState,
      enabled: track.enabled,
    })),
    peers: window.__voiceAudit.peers.map((peer) => peer.connectionState),
    peakInput: Math.max(
      ...window.__voiceAudit.samples.map((sample) => sample.input),
    ),
    peakOutput: Math.max(
      ...window.__voiceAudit.samples.map((sample) => sample.output),
    ),
    remoteTracks: window.__voiceAudit.remoteTracks.map((track) => ({
      kind: track.kind,
      state: track.readyState,
      muted: track.muted,
    })),
    dataMessages: window.__voiceAudit.events.length,
  }));
  if (
    await page
      .getByRole("button", { name: "Mute microphone", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Mute microphone", exact: true })
      .click();
  await page.waitForTimeout(600);
  report.muted = await page.evaluate(() => ({
    enabledTracks: window.__voiceAudit.tracks.filter(
      (track) =>
        track.kind === "audio" && track.enabled && track.readyState === "live",
    ).length,
    input: Number(
      document.querySelector('[data-testid="orb"]').dataset.inputEnergy,
    ),
  }));
  const signalSnapshot = await page.evaluate(async () =>
    (await fetch("/api/bootstrap")).json(),
  );
  report.learningSignals = signalSnapshot.learningSignals?.map(
    ({ type, conceptIds, sessionId }) => ({ type, conceptIds, sessionId }),
  );
  if (process.argv.includes("--round")) {
    const questionDisclosure = page.getByText(
      "Have a question before continuing?",
      { exact: true },
    );
    if (await questionDisclosure.count()) {
      await questionDisclosure.click();
      await page
        .getByRole("textbox", { name: "Question about this round" })
        .fill(
          "Who was studied in this trial? Please show me the supporting source.",
        );
      await page
        .getByRole("button", { name: "Send question", exact: true })
        .click();
      await expect
        .poll(
          async () => {
            const snapshot = await (
              await page.request.get(new URL("/api/bootstrap", page.url()).href)
            ).json();
            return snapshot.learningSignals?.some(
              (event) =>
                event.type === "question_asked" &&
                event.category === "study_population",
            );
          },
          { timeout: 15000 },
        )
        .toBe(true);
      await page.waitForTimeout(8000);
      if (await page.getByRole("dialog").count())
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close", exact: true })
          .click();
    }
    const challenge = page.getByRole("button", {
      name: "B The trial included people with and without diabetes.",
    });
    // Exercise the existing Continue/Try controls if the model waits at a section.
    for (let step = 0; step < 3 && !(await challenge.count()); step++) {
      const next = page.getByRole("button", {
        name: /^(Continue|Try the challenge)$/,
      });
      if (await next.count()) await next.click();
      await page.waitForTimeout(12000);
    }
    await page
      .getByRole("button", {
        name: "B The trial included people with and without diabetes.",
      })
      .waitFor({ timeout: 110000 });
    await page
      .getByRole("button", {
        name: "B The trial included people with and without diabetes.",
      })
      .click();
    // The existing UI lets the learner choose when to leave feedback.
    await page.waitForTimeout(7000);
    report.evidenceDrawerOpened = (await page.getByRole("dialog").count()) > 0;
    if (report.evidenceDrawerOpened)
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .click();
    if (
      await page
        .getByRole("button", { name: "Your questions", exact: true })
        .count()
    )
      await page
        .getByRole("button", { name: "Your questions", exact: true })
        .click();
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(new URL("/api/bootstrap", page.url()).href)
            ).json()
          ).run?.stage,
        { timeout: 45000 },
      )
      .toBe("questions");
    if (await page.getByRole("dialog").count())
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .click();
    await page
      .getByRole("textbox", { name: "Question about this round" })
      .fill(
        "I am finished. Please complete the round and tell me my next review.",
      );
    await page
      .getByRole("button", { name: "Send question", exact: true })
      .click();
    report.completionMethod = "agent tool";
    try {
      await expect
        .poll(
          async () =>
            (
              await (
                await page.request.get(
                  new URL("/api/bootstrap", page.url()).href,
                )
              ).json()
            ).run?.completed,
          { timeout: 15000 },
        )
        .toBe(true);
    } catch {
      report.completionMethod = "existing Complete round control";
      if (await page.getByRole("dialog").count())
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close", exact: true })
          .click();
      await page
        .getByRole("button", { name: "Complete round", exact: true })
        .click();
    }
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(new URL("/api/bootstrap", page.url()).href)
            ).json()
          ).run?.completed,
        { timeout: 15000 },
      )
      .toBe(true);
    const saved = await page.evaluate(async () =>
      (await fetch("/api/bootstrap")).json(),
    );
    report.completedRound = {
      stage: saved.run.stage,
      grade: saved.run.grade.verdict,
      xp: saved.xp,
      review: saved.review,
    };
    report.completedLearningSignals = saved.learningSignals?.map(
      ({ type, conceptIds, category }) => ({ type, conceptIds, category }),
    );
    report.learningActions = actions;
    report.transcript = await page
      .locator(".transcript-message p")
      .allTextContents();
    if (await page.getByRole("dialog").count())
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .click();
  }
  if (
    await page
      .getByRole("button", { name: "Turn microphone on", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Turn microphone on", exact: true })
      .click();
  await page.screenshot({ path: "artifacts/cortana-live.png", fullPage: true });
  if (
    await page.getByRole("button", { name: "End round", exact: true }).count()
  )
    await page.getByRole("button", { name: "End round", exact: true }).click();
  await page.locator(".status-idle").waitFor({ timeout: 15000 });
  report.afterEnd = await page.evaluate(() => ({
    liveTracks: window.__voiceAudit.tracks.filter(
      (track) => track.readyState === "live",
    ).length,
    activePeers: window.__voiceAudit.peers.filter(
      (peer) => peer.connectionState !== "closed",
    ).length,
  }));
  await page.getByRole("button", { name: "Start today’s round" }).click();
  await page
    .getByLabel("Demo access code")
    .fill(process.env.CORTANA_DEMO_ACCESS_CODE);
  await page.getByRole("button", { name: "Agree & start voice" }).click();
  await page.locator(".status-live").waitFor({ timeout: 35000 });
  report.reconnect = {
    conversationId: await page
      .locator(".voice-status")
      .getAttribute("data-conversation-id"),
    audio: await page.evaluate(() => ({
      liveMicrophones: window.__voiceAudit.tracks.filter(
        (track) => track.kind === "audio" && track.readyState === "live",
      ).length,
      activePeers: window.__voiceAudit.peers.filter(
        (peer) => peer.connectionState !== "closed",
      ).length,
    })),
  };
  // LiveKit may use publisher/subscriber peers for ONE conversation, so count
  // active conversation IDs and microphone tracks rather than equating peers to sessions.
  await page.getByRole("button", { name: "End round", exact: true }).click();
  await page.locator(".status-idle").waitFor({ timeout: 15000 });
} catch (error) {
  report.failure = error.message.split("\n").slice(0, 3).join(" ");
  report.visibleError = await page.locator(".inline-error").allTextContents();
  report.status = await page
    .locator(".voice-status")
    .textContent()
    .catch(() => "");
  report.capture = await page.evaluate(() => ({
    error: window.__voiceAudit.microphoneError,
    tracks: window.__voiceAudit.tracks.map((track) => ({
      kind: track.kind,
      state: track.readyState,
    })),
    peers: window.__voiceAudit.peers.map((peer) => peer.connectionState),
  }));
  report.learningActions = actions;
  process.exitCode = 1;
} finally {
  await browser.close();
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/live-voice-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
