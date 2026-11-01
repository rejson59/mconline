import { useJavaScale } from '../utils/guiScale';
import { useState, type CSSProperties } from 'react';
import type { Game, TradeRow } from '../game/engine';
import { displayName } from '../game/items';
import { VILLAGER_LEVEL_NAMES } from '../game/trading';
import { guiSprite } from '../game/art/uiSprites';
import {
  MERCHANT, merchantInvSlot, merchantMaxScroll, merchantRowTop, merchantRowVisible,
  merchantThumbHeight, merchantThumbOffset,
} from '../game/merchantLayout';
import type { Stack } from '../game/inventory';
import { GuiSlot, GuiOverlay, useCursorPos } from './GuiContainer';
import { useGuiInteractions } from './useGuiInteractions';
import CloseButton from './CloseButton';

/**
 * 2.27: okno handlu 1:1 jak `MerchantScreen` z Minecrafta.
 *
 * Wcześniej był to zwykły panel HTML z listą dużych zielonych przycisków.
 * Teraz rysujemy prawdziwy panel z paczki (`gui/container/villager.png`,
 * 276 × 166) i rozkładamy elementy dokładnie tam, gdzie w wanilii:
 * lista ofert po lewej (88 × 20 na wiersz), dwa sloty na towar i duży slot
 * wyniku po prawej, pasek doświadczenia mieszkańca, plakietka poziomu
 * i ekwipunek gracza 9 × 3 + pasek skrótów.
 *
 * Jak w grze: kliknięcie wiersza wybiera ofertę, a dopiero kliknięcie
 * slotu wyniku (albo dwuklik na wierszu) wykonuje wymianę.
 */

const FONT = 8; // bazowy rozmiar tekstu GUI (skalowany razem z panelem)
/** Ikonka przedmiotu wewnątrz wiersza oferty. */
function RowItem({ stack, icons, x, bad }: { stack: Stack; icons: Record<number, string>; x: number; bad?: boolean }) {
  return (
    <span style={{ position: 'absolute', left: x, top: 2, width: 16, height: 16 }}>
      <img
        src={icons[stack.id]}
        alt=""
        title={`${stack.count}× ${displayName(stack.id)}`}
        draggable={false}
        style={{ width: 16, height: 16, imageRendering: 'pixelated' }}
      />
      {stack.count > 1 && (
        <span style={{ position: 'absolute', right: 0, bottom: -1, fontSize: FONT, lineHeight: '8px', color: bad ? '#ff6060' : '#fff', textShadow: '1px 1px 0 #3f3f3f' }}>
          {stack.count}
        </span>
      )}
    </span>
  );
}

/** Czerwony krzyżyk „nie da się wymienić” – jak waniliowa ikona braku towaru. */
function BlockedCross({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <svg
      viewBox="0 0 12 12" width={size} height={size}
      style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none' }}
      aria-hidden
    >
      <path d="M1 1 L11 11 M11 1 L1 11" stroke="#c02020" strokeWidth="2.2" strokeLinecap="square" />
    </svg>
  );
}

export default function TradeScreen({ game, icons, onChange }: { game: Game; icons: Record<number, string>; onChange: () => void }) {
  const [, setTick] = useState(0);
  const mouse = useCursorPos();
  const [hover, setHover] = useState<string | null>(null);
  const [scroll, setScroll] = useState(0);
  const [selected, setSelected] = useState(0);
  const scale = useJavaScale();
  const inv = game.inventory;

  const refresh = () => {
    setTick((t) => t + 1);
    onChange();
  };

  const interact = useGuiInteractions(game, refresh);
  const level = game.tradeLevel();
  const rows = game.tradeRows();
  const restock = Math.ceil(game.tradeRestockIn());
  const maxScroll = merchantMaxScroll(rows.length);
  const shown = Math.max(0, Math.min(scroll, maxScroll));
  const active = rows[Math.min(selected, Math.max(0, rows.length - 1))] ?? null;

  const panel = guiSprite('villager_gui');

  const trade = () => {
    if (!active) return;
    if (game.tradeWith(active.index)) refresh();
  };

  // Wyczerpana oferta wybrana w liście – wanilia pokazuje wtedy szarą strzałkę.
  const soldOutArrow = !!active && active.blocked === 'uses';
  const thumbH = merchantThumbHeight(rows.length);
  const thumbTop = MERCHANT.scrollbar.y + Math.round(merchantThumbOffset(rows.length, shown) * (MERCHANT.scrollbar.h - thumbH));

  /** Wspólny styl tekstu GUI – ciemny, bez cienia, jak w Minecrafcie. */
  const guiText = (color = '#3f3f3f'): CSSProperties => ({
    color, fontSize: FONT, lineHeight: `${FONT + 1}px`, letterSpacing: 0.2, whiteSpace: 'nowrap',
  });

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDownCapture={interact}
      onPointerDown={e => { if (e.target === e.currentTarget && (e.button === 0 || e.button === 2)) { game.dropInventoryCursor(e.button === 2); refresh(); } }}
    >
      <CloseButton onClose={() => game.closeTrade()} className="mc-close-safe absolute z-50" />

      {/* Panel 276 × 166 w pikselach GUI, przeskalowany do okna. */}
      <div style={{ width: MERCHANT.width * scale, height: MERCHANT.height * scale, position: 'relative' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: MERCHANT.width, height: MERCHANT.height,
            transform: `scale(${scale})`, transformOrigin: 'top left',
            backgroundImage: panel ? `url(${panel})` : undefined,
            backgroundSize: '100% 100%',
            backgroundColor: '#c6c6c6',
            imageRendering: 'pixelated',
            fontSize: 8, lineHeight: '9px',
            userSelect: 'none',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => {
            if (maxScroll <= 0) return;
            e.stopPropagation();
            setScroll((s) => Math.max(0, Math.min(maxScroll, s + (e.deltaY > 0 ? 1 : -1))));
          }}
        >
          {/* Tytuł okna i nazwa rozmówcy (jak pasek nagłówka w wanilii). */}
          <span style={{ ...guiText('#3f3f3f'), position: 'absolute', left: MERCHANT.title.x, top: MERCHANT.title.y - 1, fontWeight: 400 }}>
            Handel
          </span>
          <span
            style={{ ...guiText('#5a5a5a'), position: 'absolute', left: 44, top: MERCHANT.title.y, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={`${game.tradeTitle()} · ${VILLAGER_LEVEL_NAMES[level - 1]} · uzupełnienie zapasów za ${restock}s`}
          >
            {game.tradeTitle()}
          </span>

          {/* ---------------- lista ofert ---------------- */}
          <div
            style={{
              position: 'absolute', left: MERCHANT.list.x, top: MERCHANT.list.y,
              width: MERCHANT.list.w, height: MERCHANT.list.h, overflow: 'hidden',
            }}
            onMouseLeave={() => setHover(null)}
          >
            {rows.map((row) => {
              if (!merchantRowVisible(row.index, shown, rows.length)) return null;
              return (
                <OfferRow
                  key={row.offer.key}
                  row={row}
                  icons={icons}
                  y={merchantRowTop(row.index) - MERCHANT.list.y}
                  selected={active?.offer.key === row.offer.key}
                  restock={restock}
                  onSelect={() => setSelected(row.index)}
                  onTrade={() => {
                    setSelected(row.index);
                    if (game.tradeWith(row.index)) refresh();
                    else refresh();
                  }}
                  onHover={setHover}
                />
              );
            })}
            {rows.length === 0 && (
              <span style={{ ...guiText('#3f3f3f'), position: 'absolute', left: 4, top: 4, whiteSpace: 'normal', width: 80 }}>
                Ten mieszkaniec nie ma teraz nic do zaoferowania.
              </span>
            )}
          </div>

          {/* ---------------- pasek przewijania (`scroller` z paczki) ---------------- */}
          <div
            style={{
              position: 'absolute', left: MERCHANT.scrollbar.x, top: MERCHANT.scrollbar.y,
              width: MERCHANT.scrollbar.w, height: MERCHANT.scrollbar.h,
            }}
            onMouseDown={(e) => {
              if (maxScroll <= 0) return;
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const rel = (e.clientY - rect.top) / (rect.height / scale);
              setScroll(Math.round(Math.max(0, Math.min(1, rel)) * maxScroll));
            }}
            onWheel={(e) => {
              if (maxScroll <= 0) return;
              e.stopPropagation();
              setScroll((v) => Math.max(0, Math.min(maxScroll, v + (e.deltaY > 0 ? 1 : -1))));
            }}
          >
            <img
              src={maxScroll > 0 ? guiSprite('merchant_scroller') ?? '' : guiSprite('merchant_scroller_disabled') ?? ''}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', left: 0,
                top: maxScroll > 0 ? thumbTop - MERCHANT.scrollbar.y : 0,
                width: MERCHANT.scrollbar.w,
                height: maxScroll > 0 ? thumbH : MERCHANT.scrollbar.h,
                imageRendering: 'pixelated', opacity: maxScroll > 0 ? 1 : 0.85,
              }}
            />
          </div>

          {/* ---------------- strzałka „towar → zapłata” ---------------- */}
          {/* W wanilii strzałka jest wtopiona w teksturę panelu; gdy oferta się
              wyczerpała, gra rysuje ją na szaro. Zamiast rozciągać sprite
              (10 × 9) na 22 × 15 px, nakładamy na wtopioną strzałkę półprzezroczystą
              płachtę w kolorze panelu – piksele zostają ostre. */}
          {soldOutArrow && (
            <div
              aria-hidden
              style={{
                position: 'absolute', left: MERCHANT.arrow.x, top: MERCHANT.arrow.y,
                width: MERCHANT.arrow.w, height: MERCHANT.arrow.h,
                background: 'rgba(198,198,198,0.78)', pointerEvents: 'none',
              }}
            />
          )}

          {/* ---------------- wybrana oferta w slotach ---------------- */}
          <GuiSlot
            x={MERCHANT.input1.x}
            y={MERCHANT.input1.y}
            stack={active ? { id: active.offer.give[0].id, count: active.offer.give[0].count } : null}
            icons={icons}
            dim={!!active && active.blocked === 'items' && game.inventory.countOf(active.offer.give[0].id) < active.offer.give[0].count}
            onHover={setHover}
          />
          <GuiSlot
            x={MERCHANT.input2.x}
            y={MERCHANT.input2.y}
            stack={active?.offer.give[1] ? { id: active.offer.give[1].id, count: active.offer.give[1].count } : null}
            icons={icons}
            dim={!!active?.offer.give[1] && active.blocked === 'items' && game.inventory.countOf(active.offer.give[1].id) < active.offer.give[1].count}
            onHover={setHover}
          />
          <GuiSlot
            x={MERCHANT.output.x}
            y={MERCHANT.output.y}
            hit={5}
            stack={active ? { id: active.offer.get.id, count: active.offer.get.count } : null}
            icons={icons}
            dim={!!active && active.blocked !== 'ok'}
            onHover={(t) => {
              if (!active) return setHover(t);
              const why = active.blocked === 'uses'
                ? `Zapasy wyczerpane – uzupełnienie za ${restock}s`
                : active.blocked === 'items'
                  ? 'Brak towaru na tę wymianę'
                  : active.blocked === 'space'
                    ? 'Brak miejsca w ekwipunku'
                    : `Kliknij, aby wymienić (zostało ${active.left}/${active.max})`;
              setHover(`${t ?? ''}\n${why}`.trim());
            }}
            onClick={() => trade()}
          />
          {/* Waniliowy znaczek „brak towaru” (`out_of_stock.png`) na slocie wyniku. */}
          {active && active.blocked === 'uses' && (
            <img
              src={guiSprite('merchant_out_of_stock') ?? ''}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', left: MERCHANT.outOfStock.x, top: MERCHANT.outOfStock.y,
                width: MERCHANT.outOfStock.w, height: MERCHANT.outOfStock.h,
                imageRendering: 'pixelated', pointerEvents: 'none',
              }}
            />
          )}

          {/* ---------------- pasek doświadczenia mieszkańca ---------------- */}
          {/* Waniliowy `MerchantScreen` nie rysuje plakietki poziomu – poziom
              widać w nazwie rozmówcy („Rolnik (Czeladnik)”) i w tym pasku. */}
          <div
            title={`${VILLAGER_LEVEL_NAMES[level - 1]} · poziom ${level} · ${Math.round(game.tradeProgress() * 100)}% do awansu`}
            style={{
              position: 'absolute', left: MERCHANT.xp.x, top: MERCHANT.xp.y,
              width: MERCHANT.xp.w, height: MERCHANT.xp.h,
              backgroundImage: `url(${guiSprite('merchant_xp_bg') ?? ''})`,
              backgroundSize: '100% 100%', imageRendering: 'pixelated',
            }}
          >
            <div
              style={{
                height: '100%', width: `${Math.round(game.tradeProgress() * 100)}%`,
                backgroundImage: `url(${guiSprite('merchant_xp_current') ?? ''})`,
                backgroundSize: `${MERCHANT.xp.w}px 100%`,
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated',
              }}
            />
          </div>

          {/* ---------------- ekwipunek gracza ---------------- */}
          {inv.slots.map((s, i) => {
            const p = merchantInvSlot(i);
            return (
              <GuiSlot
                key={i} slotArea="inventory" slotIndex={i}
                onAction={a => { game.inventoryAction('inventory', i, a); refresh(); }}
                x={p.x}
                y={p.y}
                stack={s}
                icons={icons}
                onHover={setHover}
                onClick={(right) => {
                  inv.clickSlot(i, right);
                  refresh();
                }}
              />
            );
          })}
        </div>
      </div>

      <span className="java-touch-only mc-text text-sm opacity-80" style={{ position: 'relative' }}>E / Esc – zamknij</span>

      <GuiOverlay game={game} icons={icons} hover={hover} mouse={mouse} />
    </div>
  );
}

/** Wiersz listy ofert: cena → towar, jak waniliowy przycisk `MerchantScreen`. */
function OfferRow({
  row, icons, y, selected, restock, onSelect, onTrade, onHover,
}: {
  row: TradeRow;
  icons: Record<number, string>;
  y: number;
  selected: boolean;
  restock: number;
  onSelect: () => void;
  onTrade: () => void;
  onHover: (text: string | null) => void;
}) {
  const { offer, left, max, blocked } = row;
  const soldOut = blocked === 'uses';
  const hoverText =
    `${offer.give.map((g) => `${g.count}× ${displayName(g.id)}`).join(' + ')} → ${offer.get.count}× ${displayName(offer.get.id)}\n` +
    `zapas: ${left}/${max}` +
    (soldOut ? `\nuzupełnienie za ${restock}s` : blocked === 'items' ? '\nbrakuje towaru' : blocked === 'space' ? '\nbrak miejsca' : '');
  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        onSelect();
      }}
      onDoubleClick={onTrade}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTrade(); } }}
      onMouseEnter={() => onHover(hoverText)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'absolute', left: 0, top: y, width: MERCHANT.list.w, height: MERCHANT.list.row,
        cursor: 'pointer', touchAction: 'manipulation',
        background: soldOut ? '#6f6f6f' : selected ? '#bdbdbd' : '#8b8b8b',
        borderTop: '1px solid #c6c6c6', borderLeft: '1px solid #c6c6c6',
        borderBottom: '1px solid #373737', borderRight: '1px solid #373737',
        boxShadow: selected ? 'inset 0 0 0 1px #ffffff' : undefined,
        opacity: soldOut ? 0.75 : 1,
      }}
    >
      <RowItem stack={offer.give[0]} icons={icons} x={3} bad={blocked === 'items'} />
      {offer.give[1] && <RowItem stack={offer.give[1]} icons={icons} x={21} bad={blocked === 'items'} />}
      <img
        src={guiSprite(soldOut ? 'merchant_arrow_out' : 'merchant_arrow') ?? ''}
        alt=""
        draggable={false}
        style={{ position: 'absolute', left: 37, top: 6, width: 10, height: 9, imageRendering: 'pixelated' }}
      />
      <RowItem stack={offer.get} icons={icons} x={50} />
      {soldOut && <BlockedCross x={50} y={1} size={16} />}
    </div>
  );
}
