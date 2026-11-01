import { B, BLOCKS, CREATIVE_BLOCKS } from './blocks';
import { I, ITEMS, CREATIVE_ITEMS } from './items';
// Only implemented content is exposed: no fake spawn eggs, operators or saved-hotbar features.
const functional = new Set<number>([B.CRAFTING,B.FURNACE,B.CHEST,B.ENCHANT,B.BED,B.LANTERN,B.TORCH,B.CAMPFIRE,B.BELL,B.BOOKSHELF,B.LADDER_N,B.DOOR_N,B.TRAP]);
const natural = new Set<number>([B.GRASS,B.DIRT,B.STONE,B.COBBLE,B.SAND,B.GRAVEL,B.LOG,B.LEAVES,B.BIRCH_LOG,B.BIRCH_LEAVES,B.BEDROCK,B.SNOW,B.CACTUS,B.TALLGRASS,B.FLOWER_RED,B.FLOWER_YELLOW,B.SAPLING,B.BIRCH_SAPLING,B.CLAY,B.ICE,B.PUMPKIN,B.OBSIDIAN,B.NETHERRACK,B.SOUL_SAND,B.MAGMA,B.END_STONE,B.SUGARCANE]);
const redstone = new Set<number>([B.TNT,B.REDSTONE_BLOCK,B.REDSTONE_TORCH,B.REDSTONE_LAMP,B.LEVER,B.BUTTON,B.PISTON,B.STICKY_PISTON,B.SLIME_BLOCK,B.OBSERVER,B.DISPENSER,B.NOTE_BLOCK]);
const combat = (id: number) => ITEMS[id]?.kind === 'armor' || ['sword','bow','shield'].includes(ITEMS[id]?.tool ?? '') || id === I.ARROW;
export const CREATIVE_CATEGORIES = [
  { id:'blocks', name:'Bloki budowlane', icon:B.BRICK, bottom:false, items:CREATIVE_BLOCKS.filter(id => !functional.has(id) && !redstone.has(id)) },
  { id:'colored', name:'Kolorowe bloki', icon:B.WOOL_RED, bottom:false, items:CREATIVE_BLOCKS.filter(id => /wełna|szkło/i.test(BLOCKS[id]?.name ?? '')) },
  { id:'natural', name:'Naturalne bloki', icon:B.GRASS, bottom:false, items:CREATIVE_BLOCKS.filter(id => natural.has(id) || /ruda/i.test(BLOCKS[id]?.name ?? '')) },
  { id:'functional', name:'Bloki użytkowe', icon:B.CRAFTING, bottom:false, items:CREATIVE_BLOCKS.filter(id => functional.has(id)) },
  { id:'redstone', name:'Bloki redstone', icon:I.REDSTONE, bottom:false, items:CREATIVE_BLOCKS.filter(id => redstone.has(id)) },
  { id:'tools', name:'Narzędzia i przybory', icon:I.IRON_PICK, bottom:false, items:CREATIVE_ITEMS.filter(id => (ITEMS[id]?.kind === 'tool' && !combat(id)) || ITEMS[id]?.kind === 'bucket' || [I.COMPASS,I.CLOCK].includes(id as typeof I.COMPASS)) },
  { id:'combat', name:'Walka', icon:I.IRON_SWORD, bottom:true, items:CREATIVE_ITEMS.filter(combat) },
  { id:'food', name:'Żywność i napoje', icon:I.APPLE, bottom:true, items:CREATIVE_ITEMS.filter(id => ITEMS[id]?.kind === 'food' || ITEMS[id]?.kind === 'potion') },
  { id:'ingredients', name:'Składniki', icon:I.IRON, bottom:true, items:CREATIVE_ITEMS.filter(id => ITEMS[id]?.kind === 'material') },
  { id:'search', name:'Wyszukiwanie', icon:I.COMPASS, bottom:true, items:[...CREATIVE_BLOCKS,...CREATIVE_ITEMS] },
  { id:'inventory', name:'Ekwipunek przetrwania', icon:B.CHEST, bottom:true, items:[] },
] as const;
export type CreativeCategory = typeof CREATIVE_CATEGORIES[number]['id'];
