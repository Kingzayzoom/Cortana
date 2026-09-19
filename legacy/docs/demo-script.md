# Five-minute demo

**Before you start**
- Go to Profile and click **Reset to sample history**. This puts the demo profile at a 5-day streak, with Anticoagulation due because of a confident miss.
- Use Chrome, allow the microphone once, and close other tabs that use audio.
- Keep a fallback ready: if voice fails, click **Read it instead** and run the same flow on screen.

| Time | Beat | What to do and say |
| --- | --- | --- |
| 0:00 | Problem | "Doctors don't need another dashboard or another long article. Clinical learning has to fit into an already packed day." |
| 0:25 | Introduce | Show the Today screen. "Cortana turns clinical learning into a two-minute conversation." |
| 0:40 | Start | Click **Start today's round**. The orb comes alive and Cortana starts the brief. |
| 1:10 | **Interrupt** | While Cortana is speaking: "Wait — who was included in that study?" The orb switches to cyan, Cortana answers from DAPA-HF, then you say "Continue" and it resumes at the same section. *This is the wow moment.* |
| 2:00 | Case | Cortana: "Let's see how you'd apply that." The synthetic case animates in. Say "I think B." |
| 2:20 | Feedback | The answer is graded by code, not by the model. Cortana explains why, and the feedback card shows the rationale and sources. |
| 2:45 | Evidence | Click the **DAPA-HF** chip. The evidence drawer opens and the call stays connected. |
| 3:10 | Unscripted | "What was the most important limitation?" Cortana answers from the evidence only. |
| 3:40 | Complete | "Let's wrap up." The screen shows +100 XP, +20 for the correct answer, and the streak moving to 6 days. Learning Pulse updates to Heart Failure 2 / 3. |
| 4:05 | Adaptive | Point to **Up next: Anticoagulation**, "recommended because you missed your last practice question on this topic." It's a plain rule, not a mystery score. |
| 4:30 | Architecture | ElevenLabs for voice, Gemini for reasoning, Cortana for evidence, grading and the learning engine. |

**Talking points if asked**
- Correct answers are decided by code on the server. The model only explains the result.
- Every citation comes from a curated source bundle. Unknown source ids are rejected before they reach the screen.
- The history is sample data and is labeled as such throughout the UI.
