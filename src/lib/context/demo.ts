import morning from "../../../demo-data/context/01-cardiology-morning.json";
import consult from "../../../demo-data/context/02-new-consult.json";
import shift from "../../../demo-data/context/03-hospital-shift.json";
import { normalizeScenario } from "./normalize";
export const demoScenarios = [morning, consult, shift].map(normalizeScenario);
export const defaultScenario = demoScenarios[0];
