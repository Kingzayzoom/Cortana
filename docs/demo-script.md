# Samantha judge demonstration

Use http://localhost:3102 in this workspace, or start the repository on your chosen port. Live voice requires the saved ElevenLabs credentials and the private demo access code.

1. On Today, show the existing orb and “Listen. Ask. Practice. Reinforce.” Open **Why this round?** A fresh profile explicitly shows the DAPA-HF demo selection, without invented personal history.
2. Start today's round, enter the code and allow microphone access. Wait for **Live** before presenting it as connected.
3. Interrupt during the briefing: **“Who was studied in this trial?”** Ask to see the source. Show publication, date, source type, passage and scope. Continue from the checkpoint. An interruption signal requires an actual SDK interruption callback, never a disconnect.
4. Continue the briefing. Use **Continue** if the model waits. Open the synthetic challenge and select **B**. The server supplies the deterministic grade.
5. Go to **Your questions**, then ask Samantha to complete the round. The existing **Complete round** control remains available if the agent waits.
6. Show **Your learning signal**: concepts, question categories, evidence, actual attempted/correct counts and elapsed duration. A first correct answer does not claim reinforcement.
7. Expand **View learning signal**, then the secondary developer payload. **Export learning signal JSON** downloads metadata locally; nothing is sent to Impiricus.
8. Follow the **Signal Bridge** link. Compare engagement with actual current-session educational activity. Identify the proposed ION feedback-loop role. The Samantha events and local recommendations work; the Impiricus connection is conceptual.
9. Show Learning Pulse and the next-round reason. DAPA-HF is the only supported round; no invented specialty appears.
10. End voice to release capture. Reload to show persistence. Repeated completion does not duplicate XP or completion events.

For reinforcement, use a fresh profile, answer **A**, complete, then deliberately repeat and answer **B**. The first miss adds a transparent reason to revisit. The later correct answer creates concept_reinforced and clears earlier unresolved-miss reasons.

Silent fallback: **Explore in text mode** exercises learning, grading, evidence, summary and export, clearly labeled Text preview. It does not request the microphone.

Automatically verified: real ElevenLabs connection, physical capture, assistant audio, mute, SDK interruption metadata during typed control interaction, client tools, grading, evidence, agent-tool completion, teardown and reconnect. A deliberate spoken barge-in needs human rehearsal; typed interaction is not proof of a person interrupting by voice. The hosted model can wait between sections, so keep Continue available.

Use only synthetic educational questions. Patient identifiers are unnecessary. The development-only orb harness is a synthetic test, not the live demonstration.
