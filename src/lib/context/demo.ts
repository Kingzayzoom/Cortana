import scenario0 from "../../../demo-data/context/cardiology/01-hf-urgent-hypotension.json";
import scenario1 from "../../../demo-data/context/cardiology/02-hf-renal-trend.json";
import scenario2 from "../../../demo-data/context/cardiology/03-post-pci-stable.json";
import scenario3 from "../../../demo-data/context/cardiology/04-chest-pain-consult.json";
import scenario4 from "../../../demo-data/context/cardiology/05-afib-telemetry-change.json";
import scenario5 from "../../../demo-data/context/cardiology/06-anticoag-review.json";
import scenario6 from "../../../demo-data/context/operations/07-morning-shift.json";
import scenario7 from "../../../demo-data/context/operations/08-evening-cross-cover.json";
import scenario8 from "../../../demo-data/context/operations/09-consult-backlog.json";
import scenario9 from "../../../demo-data/context/operations/10-procedure-delay.json";
import scenario10 from "../../../demo-data/context/operations/11-unit-busy.json";
import scenario11 from "../../../demo-data/context/escalation/12-urgent-review.json";
import scenario12 from "../../../demo-data/context/escalation/13-rapid-response.json";
import scenario13 from "../../../demo-data/context/escalation/14-icu-transfer-request.json";
import scenario14 from "../../../demo-data/context/escalation/15-new-admission.json";
import { normalizeScenario } from "./normalize";
export const demoScenarios = [
  scenario0,
  scenario1,
  scenario2,
  scenario3,
  scenario4,
  scenario5,
  scenario6,
  scenario7,
  scenario8,
  scenario9,
  scenario10,
  scenario11,
  scenario12,
  scenario13,
  scenario14,
].map(normalizeScenario);
export const defaultScenario = demoScenarios[0];
