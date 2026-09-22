# Engineering decisions

Choices a reviewer is likely to question, and the reason for each. Most were forced by a failure we hit while building.

## Voice and phone

**Three ElevenLabs agents, not one.** Client tools execute in a browser, and a phone call has none, so the phone agents use webhook tools. Inbound calls then need a third agent: ElevenLabs refuses a conversation whose first message or tools reference a dynamic variable the caller didn't supply, and someone dialling in supplies none. The inbound agent's tools send a constant guest marker instead of a signed session.

**The model never generates request ids.** During rehearsal the model produced strings that looked like UUIDs but weren't valid ones, and the server rightly rejected them. The voice controller now creates the id for each operation and reuses it when the same tool call is retried, which also gives idempotency for free.

**Turn eagerness stays "normal".** Eager yielding made the agent stop mid-sentence for a cough or a nearby conversation, which ruined demos in loud rooms. The agent holds the floor and keeps its turns short, so the clinician can steer in the gaps. Pausing is an explicit spoken command handled with the `skip_turn` tool.

**Numbers are pre-spoken.** `lib/content/speech.ts` turns `88/56` into "eighty-eight over fifty-six" before the briefing reaches the agent. Left to the TTS, blood pressures came out as "eighty-eight slash fifty-six" and labs as decimals.

**The clinician's name has two spellings.** `displayName` is how it's written; `spokenName` is how the voice should say it. The agent is given the spoken form, and the front desk email converts it back.

**Spoken answers are normalised on the server.** People answer "I'd go with B" or "the second one". `phone/spoken-option.ts` extracts an option only when exactly one is named; anything ambiguous is passed through unchanged, so the grader asks for clarification instead of guessing.

**Browser voice has no pause button.** The installed `@elevenlabs/react` (1.15) has no pause or resume. Rather than fake one by muting, the control is hidden; the text preview still pauses at checkpoints.

## Storage

**A distributed lock on every profile write.** Vercel runs several instances with no shared memory. Without the Redis lock, concurrent requests for one profile overwrite each other; the storage test loses 6 of 12 writes without it. The lock is `SET NX PX` with a random token and is released only by its owner.

**Profiles are one JSON document.** A profile is small and always read whole, and one document makes `withProgress` a simple read-modify-write inside the lock. It would be split if profiles grew or needed querying.

**Legacy names survive the rename.** The Redis prefix, the old cookie, the `CORTANA_*` variables and the Gmail token salt keep their names; see the table at the end of [architecture.md](architecture.md).

## Front end

**React is pinned to 19.2.** The React Three Fiber version the orb needs declares a peer range below 19.3. Pinning was preferred over forcing the peer check.

**StrictMode is off.** In React Three Fiber 9.7, StrictMode's development double mount disposed the active render root and left an empty canvas. Renderer teardown is covered by the orb harness test instead.

**The orb is vendored.** The ElevenLabs UI registry returned HTTP 429 during setup, so the official registry artifact was fetched from the `elevenlabs/ui` repository and saved in `vendor/` with its MIT licence. `components/ui/orb.tsx` adapts it: sphere normals, a specular edge and the product palette.

**The orb reacts only to real audio.** It reads the SDK's actual input and output levels, smoothed (65 ms attack, 240 ms release, a small noise floor). No production code invents speech activity. Device pixel ratio is capped at 1.5, hidden tabs stop rendering, reduced motion freezes it, and a failed WebGL context shows a labelled fallback.

**One catch-all page.** `app/[[...view]]/page.tsx` renders every view inside a single layout so the voice session, which lives in a root provider, survives navigation between pages.

**Named classes in plain CSS.** Components use semantic class names; Tailwind supplies only the reset and the theme bridge. The stylesheets are split by area and imported in cascade order from `app/globals.css`, so a rule's position still decides what it overrides.
