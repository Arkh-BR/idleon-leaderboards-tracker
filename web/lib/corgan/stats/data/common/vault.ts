// ===== VAULT DATA =====
import { UpgradeVault } from "../game/customlists.js";

export function vaultUpgPerLevel(idx: number): number {
  return Number((UpgradeVault as any)[idx]?.[5]) || 0;
}
