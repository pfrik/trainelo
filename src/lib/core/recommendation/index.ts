/**
 * Recommendation module - pure business logic
 */

export {
  buildColdStartEvidence,
  buildDeterministicCandidates,
  buildDeterministicTodayResponse,
  type TodayResponseInput,
} from "./todayResponseBuilder.js";

export {
  buildChoiceResponse,
  type ChoiceResponseInput,
} from "./choiceResponseBuilder.js";
