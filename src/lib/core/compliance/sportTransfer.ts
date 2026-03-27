/**
 * Cross-sport TSS transfer coefficients.
 *
 * When an athlete does a hard bike session, it produces systemic fatigue
 * (cardiovascular, CNS) but less musculoskeletal impact on running than
 * an equivalent running session. These coefficients discount cross-sport
 * TSS for plan-layer decisions while the EWMA keeps full systemic TSS.
 *
 * Pure data + pure function. No IO.
 */

import type { NormalizedSport } from "./types.js";

/**
 * Transfer coefficient matrix.
 * `matrix[fromSport][toSport]` = fraction of TSS that transfers.
 * "default" is the fallback for unlisted target sports.
 */
export interface TransferMatrix {
  [fromSport: string]: { [toSport: string]: number };
}

export const DEFAULT_TRANSFER_MATRIX: TransferMatrix = {
  cycling: { running: 0.6, swimming: 0.4, default: 0.5 },
  running: { cycling: 0.5, swimming: 0.3, default: 0.5 },
  swimming: { running: 0.3, cycling: 0.3, default: 0.3 },
  strength: { running: 0.4, cycling: 0.3, swimming: 0.2, default: 0.4 },
  other: { default: 0.5 },
};

/**
 * Get the transfer coefficient from one sport to another.
 * Returns 1.0 for same-sport (no discount).
 */
export function getTransferCoefficient(
  fromSport: NormalizedSport,
  toSport: NormalizedSport,
  matrix: TransferMatrix = DEFAULT_TRANSFER_MATRIX,
): number {
  if (fromSport === toSport) return 1.0;

  const row = matrix[fromSport] ?? matrix["other"] ?? {};
  return row[toSport] ?? row["default"] ?? 0.5;
}

/**
 * Compute the transferred TSS from one sport to another.
 * Same sport = full TSS. Cross-sport = discounted via transfer matrix.
 */
export function computeTransferredTss(
  fromSport: NormalizedSport,
  toSport: NormalizedSport,
  tss: number,
  matrix?: TransferMatrix,
): number {
  return tss * getTransferCoefficient(fromSport, toSport, matrix);
}
