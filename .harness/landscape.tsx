import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import OrientationGuard from "../src/components/OrientationGuard";
import { isPortraitSize, portraitGameplayBlocked } from "../src/utils/screen";
import { Game, worldSimulationActive, type UIState } from "../src/game/engine";

let checks = 0;
const test = async (name: string, run: () => void | Promise<void>) => {
  try {
    await run();
    checks++;
  } catch (e) {
    console.error(name);
    throw e;
  }
};
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://example.test/",
  pretendToBeVisual: true,
});
const w = dom.window;
const g = globalThis as unknown as Record<string, unknown>;
const descriptors = new Map<string, PropertyDescriptor | undefined>();
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  descriptors.set(key, Object.getOwnPropertyDescriptor(g, key));
  Object.defineProperty(g, key, {
    configurable: true,
    value: (w as unknown as Record<string, unknown>)[key],
    writable: true,
  });
}
g.IS_REACT_ACT_ENVIRONMENT = true;
let coarse = true;
Object.defineProperty(w, "matchMedia", {
  value: (q: string) => ({
    matches:
      q === "(pointer: coarse)"
        ? coarse
        : q === "(any-pointer: fine)"
          ? !coarse
          : false,
  }),
});
function size(width: number, height: number) {
  Object.defineProperty(w, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(w, "innerHeight", {
    configurable: true,
    value: height,
  });
  Object.defineProperty(w.screen, "width", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(w.screen, "height", {
    configurable: true,
    value: height,
  });
}
const tick = () => new Promise<void>((resolve) => w.setTimeout(resolve, 40));
const root = createRoot(w.document.getElementById("root")!);
try {
  for (const [width, height, blocked] of [
    [390, 844, true],
    [844, 390, false],
    [600, 600, false],
    [768, 1024, true],
    [1024, 768, false],
    [1024, 1366, true],
  ] as const) {
    await test(`phone/tablet policy ${width}x${height}`, () => {
      size(width, height);
      assert.equal(portraitGameplayBlocked(), blocked);
      assert.equal(isPortraitSize(width, height), height > width);
    });
  }
  await test("desktop portrait is allowed with a fine pointer", () => {
    coarse = false;
    size(600, 900);
    assert.equal(portraitGameplayBlocked(), false);
    coarse = true;
  });
  await test("legacy opt-out cannot bypass policy", () => {
    size(390, 844);
    w.sessionStorage.setItem("blockcraft-portrait-ok", "1");
    assert.equal(portraitGameplayBlocked(), true);
  });
  await test("visual keyboard size does not change physical layout orientation", () => {
    size(390, 844);
    Object.defineProperty(w, "visualViewport", {
      configurable: true,
      value: { width: 390, height: 250 },
    });
    assert.equal(portraitGameplayBlocked(), true);
    delete (w as any).visualViewport;
  });
  for (const ui of [
    "playing",
    "paused",
    "inventory",
    "chest",
    "furnace",
    "enchant",
    "anvil",
    "brewing",
    "trade",
    "chat",
    "journal",
    "waypoints",
    "dead",
  ] as UIState[]) {
    await test(`rotation cancels held input and preserves ${ui}`, () => {
      let saves = 0;
      const cursor = { id: 1, count: 7 },
        grid = [{ id: 2, count: 9 }];
      const game: any = Object.assign(Object.create(Game.prototype), {
        orientationBlocked: false,
        ui,
        keys: new Set(["KeyW", "Space"]),
        mouseLeft: true,
        mouseRight: true,
        breakProgress: 0.8,
        breakKey: "floor",
        breakTickRemainder: 0.2,
        bowDraw: 1,
        zooming: true,
        touchAim: { x: 1, y: 1 },
        aimDir: {},
        sprinting: true,
        inventory: { cursor, grid },
        setUI(s: UIState) {
          this.ui = s;
          saves++;
        },
      });
      game.setOrientationBlocked(true);
      assert.equal(game.ui, ui === "playing" ? "paused" : ui);
      assert.equal(game.keys.size, 0);
      assert.equal(game.mouseLeft, false);
      assert.equal(game.mouseRight, false);
      assert.equal(game.breakProgress, 0);
      assert.equal(game.bowDraw, -1);
      assert.equal(game.touchAim, null);
      assert.equal(game.sprinting, false);
      assert.equal(game.inventory.cursor, cursor);
      assert.equal(game.inventory.grid, grid);
      game.setOrientationBlocked(true);
      assert.equal(saves, ui === "playing" ? 1 : 0);
      game.setOrientationBlocked(false);
      assert.equal(game.ui, ui === "playing" ? "paused" : ui);
      assert.equal(game.keys.size, 0);
    });
  }
  await test("engine refuses keyboard and UI resume even before React reacts", () => {
    const game: any = Object.assign(Object.create(Game.prototype), {
      orientationBlocked: false,
      ui: "paused",
    });
    size(390, 844);
    Game.prototype.setUI.call(game, "playing");
    assert.equal(game.ui, "paused");
    for (const code of ["Escape", "KeyW", "KeyE", "KeyQ", "KeyR", "Space"])
      game.onKeyDown({ code });
    assert.equal(game.ui, "paused");
    game.lockPointer(); // no renderer needed: rejected before pointer-lock API
  });
  await test("blocked singleplayer freezes; multiplayer authority continues", () => {
    assert.equal(worldSimulationActive("paused", false), false);
    assert.equal(worldSimulationActive("paused", true), true);
  });
  let quits = 0;
  await test("real guard has no portrait bypass, focus is moved and quit remains available", async () => {
    size(390, 844);
    await act(async () => {
      root.render(<OrientationGuard onQuit={() => quits++} />);
      await tick();
    });
    assert.ok(w.document.querySelector(".mc-orient-guard"));
    assert.doesNotMatch(w.document.body.textContent!, /Graj w pionie|Pomiń/);
    assert.equal(
      w.document.activeElement?.textContent?.trim(),
      "⛶ Pełny ekran i poziomo",
    );
    const quit = [...w.document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Zapisz i wróć"),
    )!;
    await act(async () => quit.click());
    assert.equal(quits, 1);
  });
  await test("unsupported fullscreen/orientation has manual instructions, not an escape hatch", async () => {
    await act(async () => {
      w.document.querySelector("button")!.click();
      await tick();
    });
    assert.match(
      w.document.querySelector("[role=status]")!.textContent!,
      /obróć telefon ręcznie/,
    );
    assert.ok(w.document.querySelector(".mc-orient-guard"));
  });
  await test("rotate to landscape clears gate; rotating back blocks again", async () => {
    await act(async () => {
      size(844, 390);
      w.dispatchEvent(new w.Event("resize"));
      await tick();
    });
    assert.equal(w.document.querySelector(".mc-orient-guard"), null);
    await act(async () => {
      size(390, 844);
      w.dispatchEvent(new w.Event("orientationchange"));
      await tick();
    });
    assert.ok(w.document.querySelector(".mc-orient-guard"));
  });
  await test("menu portrait is informational, never a modal gameplay bypass", async () => {
    await act(async () => {
      root.render(<OrientationGuard variant="menu" />);
      await tick();
    });
    assert.ok(w.document.querySelector(".mc-orient-banner"));
    assert.equal(w.document.querySelector("[aria-modal]"), null);
  });
  console.log(`Landscape: ${checks} groups passed`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [key, value] of descriptors) {
    if (value) Object.defineProperty(g, key, value);
    else delete g[key];
  }
  delete g.IS_REACT_ACT_ENVIRONMENT;
}

// React/jsdom scheduler keeps a Node handle, as in the account suite.
process.exit(0);
