import type { ChestLootKind } from './chest';
import { villagesOverlapping, villageLootKindAt, type VillageContext } from './village';
import { structuresOverlapping, structureBlocks, type StructureKind } from './structures';
import { isLootChest } from './blocks';

const SITE_LOOT: Record<StructureKind, ChestLootKind> = {
  desert_temple: 'temple', jungle_ruin: 'temple', swamp_hut: 'swamp',
  ruined_portal: 'portal', mineshaft: 'mine', crater: 'crater',
};
/** Called only for an unconsumed loot marker, never for player-placed chests. */
export function explorationLootKind(ctx: VillageContext, x: number, y: number, z: number): ChestLootKind {
  for (const village of villagesOverlapping(x, z, x, z, ctx)) {
    const kind = villageLootKindAt(village, x, y, z);
    if (kind) return kind;
  }
  for (const site of structuresOverlapping(x, z, x, z, ctx)) {
    if (structureBlocks(site, ctx).some((b) => b.x === x && b.y === y && b.z === z && isLootChest(b.id))) return SITE_LOOT[site.kind];
  }
  return 'cave';
}
