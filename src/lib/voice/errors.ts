/** Map SDK failures to safe, actionable copy without displaying raw transport URLs. */
export function voiceErrorMessage(message: string, context?: unknown) {
  const name = context instanceof Error ? context.name : "";
  const text = `${name} ${message}`.toLowerCase();
  if (/notallowed|permission|denied.*microphone/.test(text))
    return "Microphone access was denied. Allow microphone access in your browser, then Retry.";
  if (
    /notfound|no.*microphone|no.*device|requested device not found/.test(text)
  )
    return "No microphone was found. Connect a microphone, then Retry.";
  if (/notreadable|trackstart|device.*use|could not start audio/.test(text))
    return "The microphone is unavailable or in use. Check your audio device, then Retry.";
  if (/notsupported|not supported/.test(text))
    return "Microphone capture is not supported in this browser environment. Open Cortana in a browser with an available microphone, then Retry.";
  if (/expired|expiry|token.*invalid|invalid.*token/.test(text))
    return "The voice session credential expired. Retry to get a new session token.";
  if (/401|403|unauthori|forbidden|authentication/.test(text))
    return "ElevenLabs denied the connection. Check the agent's access settings, then Retry.";
  if (/quota|billing|credit|limit|429|402/.test(text))
    return "ElevenLabs reached a usage or billing limit. Check the account limits, then Retry.";
  if (/timeout|timed out/.test(text))
    return "The voice connection timed out. Resolve any microphone permission prompt, then Retry.";
  if (/network|connection|disconnect|fetch|socket|ice/.test(text))
    return "The voice connection was interrupted. Check your network, then Retry to resume this section.";
  return "The voice session could not connect. Check your microphone and network, then Retry.";
}
