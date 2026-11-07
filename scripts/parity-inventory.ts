/** Read-only build-time inventory of actual runtime registries, never a game import. */
import { BLOCKS, CREATIVE_BLOCKS } from "../src/game/blocks";
import { ITEM_LIST } from "../src/game/items";
import { RECIPES } from "../src/game/inventory";
import { NATIVE_RECIPE_IDS } from "../src/game/refinementRecipes";
import { ENCHANTS } from "../src/game/enchant";
import { POTIONS } from "../src/game/brewing";
import { ACHIEVEMENTS } from "../src/game/achievements";
import { COMMANDS } from "../src/game/commands";
import { GAME_VERSION, MINECRAFT_TARGET } from "../src/utils/version";

export const inventory = {
  version: GAME_VERSION,
  runtimeReference: MINECRAFT_TARGET,
  registeredBlockStates: BLOCKS.filter(Boolean).length,
  creativeBlockEntries: new Set(CREATIVE_BLOCKS).size,
  registeredItems: new Set(ITEM_LIST.map((x) => x.id)).size,
  craftingRecipes: RECIPES,
  explicitRecipeBindings: NATIVE_RECIPE_IDS,
  enchantments: ENCHANTS.map((e) => ({ id: e.id, aliases: e.keys })),
  potionDefinitions: Object.keys(POTIONS).length,
  projectAchievements: ACHIEVEMENTS.length,
  projectCommands: COMMANDS.length,
};
