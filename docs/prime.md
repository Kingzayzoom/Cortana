# Cortana Prime

Open /prime for the daily three-question set. Start Prime opens a focused session without the sidebar. Start with Cortana uses the same saved questions and server grades through the existing ElevenLabs consent and language flow.

The versioned source scope is the existing DAPA-HF / diabetes-subgroup bundle. Twelve authored questions cover trial population, primary endpoint and evidence limitations; every explanation has source IDs. No additional medical topic, patient-specific recommendation, accreditation or competence measurement is implied. Sources: [NEJM trial](https://www.nejm.org/doi/full/10.1056/NEJMoa1911303) and [JAMA subgroup analysis](https://jamanetwork.com/journals/jama/fullarticle/2763950). Content has been checked against the existing source bundle; independent clinician editorial review is still appropriate before expanding beyond this educational demo.

## Saved behavior

- Empty history starts clean. No fabricated practice is seeded.
- The profile transaction stores the daily selection, cursor, first answer, reviews and completion together.
- An unstarted set reflects current contextual education triggers; a started set stays stable.
- Selection ranks reinforcement, due review, new supported concepts, then continued practice. It prefers distinct concepts and avoids recent identical questions when alternatives exist.
- Review intervals after successive correct practice are 2, 5 and 10 calendar days. A miss schedules next-session reinforcement with an alternative question. With this small three-concept catalog, continued practice may appear before the next due date; it is labeled accordingly.
- Completion awards 50 XP, plus 10 per correct first answer and 10 per concept reinforcement. Rewards are assigned once at completion. Prime uses the same practiceDays streak and total XP as Cortana.
- Crossing midnight retains the started session; completing it counts for the completion day and does not open a second rewarded set that day.
- Profile settings reset clears Prime history too. Anonymous started Prime activity follows the existing first-sign-in account migration.

## Contracts and integration

The question bank is imported by server modules only. Public unanswered questions omit correctOptionId and explanation. gradePrimeAnswer retrieves the authoritative bank entry. Spoken answer normalization accepts an exact option, letter, number, full option text or simple choice phrase; ambiguous responses request clarification without an attempt.

GET/POST /api/prime and /api/prime/tools/[tool] require the existing profile cookie; mutations validate origin, schemas and session ownership. Answer and completion retries return the saved result. Advance includes the answered question ID so retrying does not advance a second time.

Prime uses the existing ProfileLearningSignalRepository and signal array. Structured started/attempted/correct/missed/evidence/completed events and concept_reinforced events feed Learning Profile, adaptive reinforcement and the Signal Bridge. No raw spoken answer text is stored in analytics.

Run npm run agent:export and node scripts/configure-agent.mjs --apply to attach Prime tools. The prompt requires the model to wait for grading. Phone Prime uses the same implementation through signed phone tools; /prime/phone is exposed only when phone integration is configured. The existing email-front-desk, fixed phone briefing, context, lesson, language and authentication features remain available.

## Checks

Unit tests cover selection, review intervals, invalid/ambiguous answers, first-answer persistence, concurrent duplicate requests, reward idempotency, midnight behavior, profile isolation, evidence events, and voice tool contracts. Browser tests cover the full quiz, evidence drawer, reload, completion, mobile, keyboard and CSRF handling.

