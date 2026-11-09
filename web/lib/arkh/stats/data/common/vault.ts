// ===== VAULT DATA =====
import { UpgradeVault } from "@/lib/game/data/generated/customlists.js";

export function vaultUpgPerLevel(idx: number): number {
  return Number((UpgradeVault as any)[idx]?.[5]) || 0;
}
