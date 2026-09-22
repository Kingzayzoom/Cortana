# Connecting a phone to Samantha

How to make Samantha call a phone, and answer one. Everything here was done end to end on a live line; the troubleshooting table is the list of failures we actually hit, with the fix for each.

## What you are connecting

```
   Samantha (this app)              ElevenLabs                     A carrier
   ──────────────────              ──────────                     ─────────
   places the call        ──────►  runs the conversation  ──────► rings the phone
   answers tool calls     ◄──────  asks for facts and grades
```

Three accounts, each doing one job:

| Piece          | Job                                                             | Needed                                                          |
| -------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| **ElevenLabs** | The voice, the turn-taking, and the agent that calls your tools | API key with ElevenAgents **write** permission (`convai_write`) |
| **A carrier**  | The actual phone number and minutes                             | Twilio, or any SIP provider such as Telnyx, Plivo or SignalWire |
| **This app**   | The briefing, the grading, the front desk email                 | Deployed somewhere ElevenLabs can reach without a login         |

Two ElevenLabs agents get created, and the reason is not arbitrary:

- **Samantha Phone** handles calls _you place_. Its tools receive a signed session naming the learner, so progress is saved.
- **Samantha Inbound** answers calls _to your number_. A caller has no profile to sign for, and ElevenLabs refuses a conversation whose tools reference a dynamic variable nobody supplied — so this agent's tools carry a constant guest value instead.

## Step 1 — ElevenLabs

1. Create an API key with **ElevenAgents / Conversational AI write access**. A read-only key can fetch an agent but cannot mint a call token, and the failure looks like a permissions error at call time rather than at setup.
2. Put it in `.env.local`:

   ```bash
   ELEVENLABS_API_KEY=sk_...
   ELEVENLABS_AGENT_ID=agent_...   # the browser agent, if you already have one
   ```

3. Generate the local secrets:

   ```bash
   node scripts/prepare-local.mjs
   ```

   This writes `SAMANTHA_SESSION_SECRET`, `SAMANTHA_DEMO_ACCESS_CODE` and `SAMANTHA_PHONE_TOOL_SECRET` without touching values you already set.

## Step 2 — Get a phone number

### Option A: Twilio (simplest, but its trial has a catch)

Twilio is a native ElevenLabs integration: you paste an Account SID and auth token, and ElevenLabs handles the rest.

The catch: **a Twilio trial gives free minutes but no phone number**, and buying one requires upgrading, which has a minimum payment. If you already have a paid Twilio account, this is the easiest path by far.

1. Twilio Console → **Phone Numbers → Manage → Buy a number**, filtered to **Voice**.
2. If the account is on trial, add every phone you intend to call under **Verified Caller IDs**. Trial accounts can only call verified numbers, and each call opens with a recorded trial notice the person must acknowledge.

### Option B: a SIP carrier (what we used, free on a trial)

Telnyx, Plivo and SignalWire trials include a number plus a small credit. We used Telnyx.

1. Sign up, then **upgrade out of "pretrial"** — it is free, and verification is through GitHub or LinkedIn. Pretrial accounts cannot use outbound voice or SIP trunking at all, so everything below silently fails until this is done.
2. **Numbers → Search & Buy Numbers**, filtered to Voice. Buy one.
3. **Verified Numbers**: add the phone you will call. A trial allows one at a time.
4. **Voice → Outbound Voice Profiles**: create one, allow **United States and Canada**, save. Without a profile attached, every outgoing call is rejected.
5. **Voice → SIP Trunking → Add SIP Connection**:
   - Connection type **FQDN**, and add the FQDN `sip.rtc.elevenlabs.io` on port 5060
   - Authentication **Credentials** — set a username and password, and write them down exactly, including capitals
   - **Inbound** tab: destination format `+E.164`, SIP transport **TCP**, pick your region
   - **Outbound** tab: select the voice profile from step 4
   - **Numbers** tab: assign the number you bought

## Step 3 — Import the number into ElevenLabs

**ElevenLabs → Phone Numbers → Import number.**

For **Twilio**, give the number in E.164 (`+15715551234`) plus the Account SID and auth token.

For a **SIP trunk**:

| Field                   | Value                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Phone number            | `+15715551234`                                                 |
| Outbound address        | your carrier's SIP host, e.g. `sip.telnyx.com`                 |
| Transport               | **TCP** — match what the carrier expects                       |
| Media encryption        | **Disabled**, unless the carrier has it on                     |
| Outbound authentication | The username and password from step 2                          |
| Inbound authentication  | Leave empty. Telnyx does not use digest auth on inbound trunks |

**The username is case sensitive.** `Samantha` and `samantha` are different users, and the mismatch surfaces as `SIP 403 Forbidden` with no further explanation. We lost an hour to exactly this.

## Step 4 — Create the agents

Both scripts print their plan first and change nothing until you add `--apply`.

```bash
# Outbound: calls the learner, saves their progress
node scripts/configure-phone-agent.mjs --url=https://your-app.example --apply

# Inbound: answers calls to your number, as a guest
node scripts/configure-inbound-agent.mjs --url=https://your-app.example --apply
```

`--url` must be the **public** address of your deployment. ElevenLabs calls your tools directly from its own servers, so a preview URL behind a login, or `localhost`, will not work.

Each script copies the voice and model from your existing agent, writes the tool definitions pointing at your URL, and stores the created IDs under `.cortana/` so re-running updates rather than duplicating. The second one also points your number's incoming calls at the inbound agent; outbound is unaffected, because those requests name their agent explicitly.

## Step 5 — Environment variables

| Variable                     | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `ELEVENLABS_API_KEY`         | Mints call tokens and configures agents        |
| `ELEVENLABS_PHONE_AGENT_ID`  | Printed by `configure-phone-agent`             |
| `ELEVENLABS_PHONE_NUMBER_ID` | Printed after the number is imported           |
| `SAMANTHA_PHONE_TOOL_SECRET` | Shared secret the agent presents to your tools |
| `SAMANTHA_SESSION_SECRET`    | Signs the per-call session                     |
| `SAMANTHA_DEMO_ACCESS_CODE`  | Required before any call is placed             |
| `SAMANTHA_PHONE_PROVIDER`    | `twilio` (default) or `sip`                    |
| `RESEND_API_KEY`             | Optional: the front desk email                 |

On Vercel, add them under **Settings → Environment Variables** for **Production**, then **redeploy**. Variables only reach new deployments — adding one to a running project changes nothing, which is a failure that looks exactly like a missing key.

## Step 6 — Check before you dial

```bash
node scripts/check-phone-setup.mjs --url=https://your-app.example
```

It reports, without changing anything: whether the number is imported and its ID, whether the agents exist, whether ElevenLabs can reach your tools without a login, and whether the deployed tool secret matches your local one. Every line reads `OK` before a call will work.

Then place one from the app's **Phone Round** page, or dial the number yourself to test the inbound agent.

## Reading what happened on a call

Every call is a conversation you can inspect, which is the fastest way to debug:

```bash
node -e 'import("@next/env").then(async({default:e})=>{
  e.loadEnvConfig(process.cwd());
  const key = process.env.ELEVENLABS_API_KEY;
  const list = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${process.env.ELEVENLABS_PHONE_AGENT_ID}&page_size=3`,
    { headers: { "xi-api-key": key } }).then(r => r.json());
  for (const c of list.conversations) {
    const d = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${c.conversation_id}`,
      { headers: { "xi-api-key": key } }).then(r => r.json());
    console.log(c.status, d.metadata?.termination_reason ?? "");
    for (const t of d.transcript ?? []) console.log(` [${t.role}] ${t.message ?? ""}`);
  }
})'
```

A failed call carries a `termination_reason` that names the cause outright.

## When something goes wrong

| What you see                                                           | Cause                                                                            | Fix                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `SIP 403 Forbidden`                                                    | Digest username or password mismatch, often capitalisation                       | Match both ends exactly                                               |
| `SIP 403` with credentials correct                                     | No outbound voice profile on the connection, or the carrier is still in pretrial | Attach a profile; finish the free account upgrade                     |
| `Missing required dynamic variables in first message`                  | The greeting references `{{variable}}` and nobody supplied it                    | Use a greeting with no variables; personalise in the next sentence    |
| `Missing required dynamic variables in tools`                          | A tool references a dynamic variable an inbound caller cannot supply             | Use the inbound agent, whose tools carry a constant instead           |
| Call connects, then Samantha says she cannot load the briefing         | Your tools are unreachable or the secret does not match                          | Run the check script; confirm the deployment is public and redeployed |
| "Phone rounds are not configured on this server"                       | One of the phone variables is missing in the deployed environment                | Add it and redeploy                                                   |
| "The carrier account is on a trial and can only call verified numbers" | Exactly that                                                                     | Verify the number, or add funds                                       |
| Voice sounds choppy                                                    | Jitter buffer disabled on the SIP connection                                     | Enable it; consider offering only PCMU to avoid transcoding           |
| She interrupts herself whenever the room is noisy                      | Turn-taking set to eager                                                         | Set eagerness back to normal and let the caller steer between turns   |

## Limits worth knowing

- 3 calls per profile per 10 minutes, 12 per hour across the server.
- A call session is signed for one profile and one round, and expires after 45 minutes.
- The learner's phone number is never stored; only the conversation ID is kept, so the page can follow the call.
- Inbound callers can hear a briefing, ask about it, and have a front desk message sent. They cannot touch anyone's saved progress.
