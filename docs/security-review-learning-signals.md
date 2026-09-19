# Focused security review: learning signals

Reviewed September 19, 2026 against baseline 64d0b0448b84968aaf71a3a2a048dda638376a89. Scope: changed application files, event pipeline, UI/export, persistence and tests. This is an implementation review, not a certification or independent penetration test.

## Trust boundaries

The existing signed HttpOnly SameSite cookie identifies the demo profile. Same-origin validation, the request-body size limit, strict Zod validation, stale-run rejection and per-profile rate limiting remain on every learning mutation.

The observation action accepts only bounded enums. It cannot accept a grade, completion, arbitrary concept/source ID, raw transcript, patient identifier or extra text field. Timestamps, concept mappings and challenge outcomes are server-owned. The export constructs an explicit allowlisted shape and validates it before download. React renders values as text; no HTML injection or external-script capability was added. Local Blob download URLs are revoked.

Question text is classified and discarded. No audio or transcript persistence was added to analytics. Existing replay fingerprints previously contained serialized answer request bodies, potentially including free-form text. They now store SHA-256 digests; old fingerprints migrate when a profile is read, preserving retry semantics.

## Validation

- Unknown categories/IDs, extra raw-text fields and forged grade observations are rejected.
- Existing cross-origin, profile-isolation, request-conflict and stale-run tests pass.
- Duplicate signal IDs, completion callbacks and typed-message/SDK echoes do not inflate metrics.
- A browser test submits a fictional PHI-like ambiguous answer and checks the persisted test-profile file: the raw text and marker are absent.
- An independent browser profile sees an empty signal history.
- Built client assets are checked against the actual configured API key, session secret and private access code.
- No Impiricus endpoint or network client exists; export is local.
- Legacy implementation files are unchanged.
- The newer upstream Vercel/Redis commits were merged without replacing their storage, shared rate limits or deployment diagnostics. The fingerprint migration runs in both file and Redis adapters. An emulator integration test verifies signal persistence and duplicate suppression across independent server instances, including migration of an old raw fingerprint.

No new exploitable issue was identified in this focused review. The prior raw-body fingerprint retention issue was corrected and tested.

## Prototype boundaries

Browser observations can be created by the profile owner; they are not tamper-proof assessments, clinical competence evidence or regulatory evidence. Demo cookies are not full HCP authentication. The file fallback and in-process rate limits require a single persistent Node process; the upstream Redis path supports shared deployment state. Redis was verified with the repository's emulator, not a production database or fault-injection audit of lease expiry. Live voice reaches ElevenLabs after consent; this review does not assert provider-side retention guarantees. No HIPAA compliance or production clinical validation is claimed.
