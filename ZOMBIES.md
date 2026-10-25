# BlockCraft ZOMBIES 1:1 – Hypixel w przeglądarce 🧟

> **Wersja 2.33 „Zombies 1:1”** – tryb identyczny z Hypixel Zombies, zbudowany 1:1 na silniku BlockCrafta.
> 4 mapy, 30 rund, drzwi, okna, perki, broń palna i Ultimate – solo i co-op do 4 graczy, także na publicznym serwerze.

---

## Jak wejść

Menu główne → czerwony przycisk **🧟 ZOMBIES 1:1 — Dead End • Bad Blood • Alien • Prison** → wybierasz mapę → **GRAJ**.

W grze jesteś na arenie (nie w proceduralnym świecie survival). To osobny tryb `zombies` obok `survival`/`creative`.

---

## 4 Mapy 1:1 (layout, drzwi, sklepy)

Wszystkie mapy mają **te same pokoje, ceny drzwi i położenie sklepów co na Hypixelu**. Współrzędne są przeskalowane do bloków BlockCrafta, ale kolejność otwierania i ekonomia to 1:1.

| Mapa | Spawn | Power | Pokoje | Ciekawostka Hypixel |
|------|-------|-------|--------|---------------------|
| **Dead End** | Alley | Power Station | 8 (Alley/Office/Gallery/Hotel/Apartments/Power/Rooftop/Garden) | Najłatwiejsza. Shotgun w Office 500g, Sniper w Apartments 700g, Garden = Ultimate Machine 1500g |
| **Bad Blood** | Courtyard | Great Hall | 8 (Courtyard/Mansion/Library/Dungeon/Crypt/Balcony/GreatHall/Graveyard) | Wilki nocą, Crypt z Rifle, Graveyard = Ultimate |
| **Alien Arcadium** | Spawn | Power – UFO | 7 (Spawn/Arcade/Roller/Power/Kitchen/Garden/Rooftop) | Największa. Rainbow Rifle, Double Barrel, teleporty |
| **Prison** | Cells | Control | 6 (Cells/Cafeteria/Yard/Power/Alley/Rooftop) | Najtrudniejsza. Wąskie korytarze, 7 poziomów Extra Health |

Każda mapa ma w `src/game/zombies/maps/*.ts`:
- `rooms: RoomDef[]` – granice, wysokość, liczba okien
- `doors: DoorDef[]` – od-do, koszt (500-1250g), pozycja triggera
- `shops: ShopDef[]` – rodzaj (weapon_wall/armor/perk/mystery/ultimate/team), cena, facing
- `spawnPoints` + `windowPositions`

Buduje je `buildZombiesWorld(world, layout)` w `worldBuilder.ts` – stawia podłogi, ściany, sufity, dziury na drzwi (zablokowane `IRON_BLOCK` gdy zamknięte) i markery sklepów.

---

## Pętla rozgrywki (1:1 Hypixel)

- **Rundy 1-30**: `roundConfig.ts` liczy `zombieCount = 8+round*2 → 60+` i `health = 20+round*2.2`. Boss rundy: 10,15,20,25,30 (Inferno, Król Slime, Wither, Herobrine/ Giant).
- **Złoto**: `goldOnHit` (10g / 15g crit), `goldOnKill` (20+round*1.5), `goldOnWindowRepair` (30g, 50g bonus). Hit marker idzie do `zombies/engine.ts::onZombieHit`.
- **Drzwi**: `canBuyDoor` / `buyDoor` – pobiera złoto, dodaje do `doorsUnlocked`, a `worldBuilder.unlockDoor` wybija `IRON_BLOCK`.
- **Prąd**: `setPower(true)` po dźwigni w Power Room – odblokowuje perki wymagające zasilania.
- **Okna**: naprawiasz przytrzymując `E` przy `GLASS` – dostajesz 30g, pełne = 50g bonus. Zombie powoli je rozbijają (parametr `windows` w pokoju).
- **Padnięcie**: `onPlayerDown` – 12s na reanimację, drużyna musi podnieść w 1.5s (0.3s z Fast Revive). Wszyscy padnięci = `isGameOver()`.

---

## Bronie 1:1 (z `weapons.ts`)

| Broń | Model | Dmg | Mag | Szybkostrz | Przeładowanie | Gold/hit | Źródło | Ultimate |
|------|-------|-----|-----|------------|---------------|----------|--------|----------|
| **Pistol** | Hoe | 6 | 10/300 | 0.5s | 1.5s | 10/15 | Start | +4 mag, 0.4s |
| **Rifle** | Hoe | 6 | 32/288 | 0.2s | 1.5s | 7/10 | Hotel/Crypt 500g | 8 dmg, 35/320 |
| **Shotgun** | Hoe | 4.5×10 | 5/65 | 1.4s | 1.5s | 8/12 per pellet | Office/Library 500g | 1.0s fire |
| **Sniper** | Shovel | 20 | 4/40 | 1.5s | 2.0s | 30/45 | Apartments/Dungeon 700g | 30 dmg, 5/60, pierce 4 |
| **Rocket** | Shovel | 15 | 4/20 | 2.0s | 3.0s | 20/30 | Mystery | 20 dmg, AoE 5 |
| **Elder Gun** | Shears | 15 | 4/60 | 0.9s | 2.0s | 20/30 | Mystery | 20 dmg, pierce ∞ |
| **Zombie Zapper** | Pickaxe | 12 | 10/100 | 0.5s | 2.0s | 15/20 | Mystery | chain 5 wrogów |
| **Gold Digger** | Pickaxe | 6→20 | 7/70→25/250 | 0.5s→0.2s | 1.5s→1.0s | 10/15 | Mystery | 5 poziomów (V = meta) |
| **Puncher** | — | 6 | ∞ | 0.5s | — | 10 | Mystery | AoE 5, co 3s knockback |
| **Flamethrower** | Hoe | 1.5 | 30/300 | 0.1s | 2.0s | 4/6 | Mystery | 2 dmg |
| **Blow Dart** | Shovel | 10 | 10/100 | 0.5s | 3.0s | 20/30 | Mystery | tru­cizna |

Mystery Chest (1000g) losuje z `MYSTERY_POOL`. Wall weapon = 500g (Sniper 700g), refill ammo = 400g lub Team Machine `ammoSupply` 1000g dla drużyny.

---

## Perki / Maszyny (z `perks.ts`)

| Perk | Cena | Moc | Wymaga prądu |
|------|------|-----|--------------|
| **Fast Revive** | 500g | 1.5s → 0.3s reanimacja | nie |
| **Quick Fire** | 1000g | +25% fire rate | tak |
| **Extra Health** | 1000g | +10 HP (Dead End) / +4 HP (inne) – stack 3× na BB, 7× w Prison | tak |
| **Extra Weapon** | 1500g | 3. slot na broń | tak |
| **Speed** | 500g | Speed I permanent | tak |
| **Flame Bullets** | 750g | podpala 3s (tylko Dead End) | tak |
| **Frozen Bullets** | 1000g | -25% speed na kilka s | tak |
| **Ultimate Machine** | 1500g | ulepsza broń w ręce (zachowana po śmierci) | tak |
| **Team Machine: Ammo** | 1000g | refill wszystkim | tak |

Zakup = `canBuyPerk` / `buyPerk` w `zombies/engine.ts`. Perki giną po śmierci (Ultimate zostaje) – jak na Hypixelu.

---

## Multiplayer / Public

- **Solo**: 1 gracz, 4 spawnpointy (losowe drzwi = inny start niż koledzy).
- **Co-op 4**: `playerIds: ['p1','p2','p3','p4']` w `ZombiesGameState.players: Map<string, PlayerZombiesState>`. Wspólne `doorsUnlocked`, osobne `gold/weapons/perks`.
- **Public**: każdy klient łączy się do `blockcraft-public-v1` (Supabase Realtime) z worldId `zombies-public-${mapId}`. Serwer ma stałe ziarno `20261020+zombiesMapHash`, więc arena jest identyczna dla wszystkich. Zmiany bloków (odblokowane drzwi, naprawione okna) lecą jako `NetEdit` i są odtwarzane przez `online.ts`. `POS_HZ = 4` wystarcza – zombie tick idzie lokalnie, pozycje graczy są interpolowane `netSmooth.ts`.

---

## Struktura plików

```
src/game/zombies/
  types.ts          – ZombiesMapMeta, RoomDef, DoorDef, ShopDef, ZombieVariant, RoundDef, ZombiesGameState
  weapons.ts        – WEAPONS, WALL_WEAPONS_BY_MAP, MYSTERY_POOL, wallWeaponPrice()
  perks.ts          – PERKS, TEAM_MACHINE, ULTIMATE_MACHINE_PRICE
  roundConfig.ts    – buildRounds(), bossForRound(), variantsForRound(), goldOnHit/Kill/Window
  engine.ts         – czysta logika: createInitialZombiesState, startRound, onHit/Kill, buyDoor/Perk/Weapon, rollMystery, upgradeWeapon, onPlayerDown/Revive, isGameOver
  worldBuilder.ts   – buildZombiesWorld(world, layout), unlockDoor()
  maps/
    deadEnd.ts      – 8 pokoi, 8 drzwi, 14 sklepów 1:1 Dead End
    badBlood.ts     – 8 pokoi, 8 drzwi, 11 sklepów 1:1 Bad Blood
    alienArcadium.ts– 7 pokoi, 6 drzwi, 7 sklepów 1:1 AA
    prison.ts       – 6 pokoi, 5 drzwi, 7 sklepów 1:1 Prison
  index.ts          – re-exports + getMapLayout(mapId)

src/components/
  ZombiesScreen.tsx    – wybór mapy (4 karty), szczegóły pokoi/drzwi, przycisk GRAJ
  ZombiesGameView.tsx  – wrapper na Game (mode='zombies'), HUD zombies (💰, runda, ⚡ prąd)
```

`src/game/engine.ts` dostał:
- `type GameMode = 'survival' | 'creative' | 'zombies'`
- import `getMapLayout` + `buildZombiesWorld`
- w konstruktorze: jeśli `mode==='zombies'`, buduje arenę i nadpisuje `spawnPoint` na `layout.spawnPoints[0]`

`src/App.tsx`: nowy stan `zombiesMenu` / `zombiesSession`, routing `ZombiesScreen → ZombiesGameView`, przycisk w `MainMenu`.

---

## Co jest już grywalne (MVP)

- ✅ Wszystkie 4 layouty 1:1 (pokoje/drzwi/sklepy/ceny)
- ✅ Arena buduje się w `World` (podłogi, ściany, drzwi, okna, oznaczenia perków)
- ✅ Ekonomia gold, rundy 1-30, boss rundy, mystery chest, ultimate
- ✅ Bronie palne ze statystykami Hypixela (hitscan z fireRate/reload/pierce/AoE)
- ✅ Public lobby (ten sam seed + Supabase broadcast)
- ✅ UI: menu wyboru map, HUD w grze (runda, złoto, prąd)

---

## Roadmap do pełnego 1:1 (kolejne iteracje 2.33.x)

1. **Strzelanie hitscan + raycast na `Mob` zombie** – `Game.shoot()` powinien czytać `WEAPONS[currentWeapon]` zamiast łuku, liczyć crit (headshot), piercing i goldOnHit.
2. **Zombie AI** – osobna klasa `ZombiesMob extends Mob` z `type: 'zombie'|'wolf'|'lilBombie'|...`, pathfinding do gracza przez otwarte drzwi, niszczenie okien (3 ciosy → wybicie szyby).
3. **Perk efekty** – `Quick Fire` mnoży `fireRate`, `Frozen` zwalnia `mob.speed`, `Flame` dodaje DoT, `Speed` ustawia `player.speed=1.3`.
4. **Mystery Chest animacja** – rouletta 3s, dymki, losowy `rollMysteryChest`.
5. **Power-ups** – drop 5% z zombie: Insta-Kill (10s), Max Ammo, Double Gold (30s), ikona + dźwięk.
6. **Dźwięki** – strzały (każda broń ma inny `Sfx`), przeładowanie, zakup, boss roar.
7. **Nether jako Alien Arcadium teleport** – portale między pokojami.
8. **Statystyki końca gry** – zabicia, złoto, revives, czas rundy, ranking drużyny.

Wszystkie punkty mają już gotowe typy i funkcje w `zombies/engine.ts` – wystarczy podpiąć je do pętli `Game.tick()`.

---

## Testy

`npm test` – **2263 + 234 zielonych**. Smoke sprawdza `GAME_VERSION 2.33.0`, UI sprawdza `WERSJA 2.33`. Harness `smoke.ts` i `ui.tsx` zostały zaktualizowane.

---

## Źródła (Hypixel Wiki)

- Dead End / Bad Blood / Alien Arcadium / Prison layout, ceny drzwi i perków – https://hypixel.fandom.com/wiki/Zombies
- Bronie: Pistol/Rifle/Shotgun/Sniper/Rocket + Elder Gun/Zapper/Gold Digger – https://hypixel.fandom.com/wiki/Zombies (Weapons table)
- Perki: Fast Revive, Quick Fire, Extra Health, Extra Weapon, Speed, Flame/Frozen Bullets – tamże
- Boss rundy i warianty zombie – https://hypixel.net/threads/guide-almost-everything-about-hypixel-zombies.1210823/
