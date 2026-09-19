# Two-minute local demonstration

1. Open http://localhost:3100. Point out the procedural orb and the three stages of today's round.
2. Click **Explore in text mode**. This is explicitly labeled **Local preview · microphone off**.
3. Read “Who was studied”, press Continue, read the finding, and open “Have a question before continuing?”. Ask “Who was studied?” and show its source. Continue from the same section.
4. Finish the limitation and select **Try the challenge**.
5. Type “maybe B or C” to show clarification without grading. Then select B. The fixed server answer key supplies the result and rationale.
6. Click **See the evidence**. Inspect publication, date, passage, original link and scope. Close the drawer; the lesson remains in place.
7. Go to **Your questions**. Ask “Can you prescribe for my patient?” to demonstrate the explicit unsupported-question response.
8. Complete the round. Show the saved result, review date, learning pulse and XP. Reload. Repeat completion/review to demonstrate that XP is not duplicated.
9. Explore My Rounds, search the two sources in Evidence Library, inspect Learning Profile, and adjust reduced motion in Settings.

For an incorrect first answer use A; the result is supportive, earns 100 completion XP without the first-correct bonus, and schedules tomorrow's review. A correct first answer earns 120 XP and a seven-day review. Calendar calculations use the profile timezone.

For live voice, follow `elevenlabs-setup.md`. Local preview contains a deliberately small question matcher, not an independent chatbot or synthetic speech service. It sends no microphone audio and makes no live connection claim.

The development-only `/dev/orb` route is an explicitly labeled synthetic signal harness. It contains silence, soft input, strong input and output samples; input mute, reduced motion, WebGL fallback and renderer unmount controls. Never present its sample signals as live speech.
