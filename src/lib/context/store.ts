import { withProgress } from "../server/store";
import { normalizeScenario } from "./normalize";
import { defaultScenario } from "./demo";
import { RequestError } from "../server/errors";
import type { ContextScenario } from "./types";
export async function readActiveScenario(
  profileId: string,
  runId?: string,
): Promise<ContextScenario | null> {
  return withProgress(profileId, (data) => {
    if (runId && (data.run?.id !== runId || data.run.completed))
      throw new RequestError("This context session is no longer active.", 409);
    return data.contextScenario === undefined
      ? structuredClone(defaultScenario)
      : data.contextScenario === null
        ? null
        : normalizeScenario(data.contextScenario);
  });
}
export async function setActiveScenario(profileId: string, input: unknown) {
  const scenario = input === null ? null : normalizeScenario(input);
  return withProgress(profileId, (data) => {
    data.contextScenario = scenario;
    return scenario;
  });
}
