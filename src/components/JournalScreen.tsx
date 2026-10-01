import { useMemo, useState } from 'react';
import type { HUDState } from '../game/engine';
import { ACHIEVEMENTS } from '../game/achievements';
import { CHALLENGES, type ChallengeId } from '../game/challenges';

type JournalTab = 'journey' | 'achievements';
type JournalFilter = 'all' | 'todo' | 'done';

export const JOURNAL_CHAPTERS = [
  { title: 'Pierwsze kroki', text: 'Zdobądź podstawowe surowce i przygotuj narzędzia.', goals: ['wood', 'craft', 'pick'] },
  { title: 'Bezpieczna przystań', text: 'Zadbaj o światło i miejsce na noc.', goals: ['torch', 'home', 'stash'] },
  { title: 'Wyprawa pod ziemię', text: 'Zejdź głębiej, wydobądź rudy i rozpal piec.', goals: ['cave', 'coal', 'iron', 'diamond'] },
  { title: 'Życie w osadzie', text: 'Odkryj wioskę, poznaj mieszkańców i rozpocznij handel.', goals: ['village', 'trade', 'emerald', 'bell'] },
  { title: 'Sztuka zaklinania', text: 'Zbierz składniki i ulepsz wyposażenie magią.', goals: ['lapis', 'book', 'table', 'enchant'] },
  { title: 'Za portalem', text: 'Zbuduj przejście i poznaj niebezpieczeństwa Netheru.', goals: ['portal', 'nether', 'quartz', 'ghast'] },
  { title: 'Dalsze horyzonty', text: 'Staw czoła Endermanowi i wykorzystaj moc jego perły.', goals: ['enderman', 'pearl'] },
  { title: 'Wyprawa i ratunek', text: 'Złów rybę, przyjrzyj się okolicy i zadbaj o narzędzia.', goals: ['fisher', 'surveyor', 'smith', 'undying'] },
  { title: 'Godzina alchemika', text: 'Napełnij fiolki, rozpal statyw i warzy swoje pierwsze eliksiry.', goals: ['alchemist', 'tonic', 'fireproof', 'potioneer'] },
  { title: 'Szlak sześciu biomów', text: 'Odwiedź osobiście sześć różnych krain. Za pierwsze wejście do każdej otrzymasz 3 PD w Survival.', goals: ['biome_swamp', 'biome_savanna', 'biome_jungle', 'biome_taiga', 'biome_wasteland', 'biome_meadow'] },
  { title: 'Wyzwania świata', text: 'Buduj, walcz i odkrywaj. Postęp zapisuje się w świecie, a ukończenie daje jednorazową nagrodę.', goals: ['challenge_builder', 'challenge_hunter', 'challenge_explorer'] },
] as const;

export function journalProgress(unlocked: string[]) {
  const have = new Set(unlocked);
  return JOURNAL_CHAPTERS.map((chapter) => {
    const done = chapter.goals.filter((id) => have.has(id)).length;
    return { ...chapter, done, total: chapter.goals.length, complete: done === chapter.goals.length };
  });
}

function normalize(text: string) {
  return text.replace(/[łŁ]/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl');
}

export default function JournalScreen({ hud, unlocked, onClose }: { hud: HUDState; unlocked: string[]; onClose: () => void }) {
  const [tab, setTab] = useState<JournalTab>('journey');
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [query, setQuery] = useState('');
  const have = useMemo(() => new Set(unlocked), [unlocked]);
  const chapters = useMemo(() => journalProgress(unlocked), [unlocked]);
  const totalGoals = JOURNAL_CHAPTERS.reduce((sum, chapter) => sum + chapter.goals.length, 0);
  const completeGoals = chapters.reduce((sum, chapter) => sum + chapter.done, 0);
  const shownChapters = chapters.filter((chapter) => {
    if (filter === 'todo' && chapter.complete) return false;
    if (filter === 'done' && !chapter.complete) return false;
    if (!query.trim()) return true;
    const text = normalize(`${chapter.title} ${chapter.text} ${chapter.goals.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title ?? '').join(' ')}`);
    return text.includes(normalize(query.trim()));
  });
  const achievements = ACHIEVEMENTS.filter((achievement) => {
    const complete = have.has(achievement.id);
    if (filter === 'todo' && complete) return false;
    if (filter === 'done' && !complete) return false;
    return !query.trim() || normalize(`${achievement.title} ${achievement.text}`).includes(normalize(query.trim()));
  });

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="journal-title">
      <section className="mc-panel flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden p-3 sm:p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="journal-title" className="text-2xl font-bold text-[#303030]">Dziennik przygód</h2>
            <div className="text-sm text-[#444]">{hud.worldName} · dzień {hud.day} · {hud.biome}</div>
          </div>
          <button className="mc-btn !w-auto !px-4 !py-2" onClick={onClose} aria-label="Zamknij dziennik">Zamknij</button>
        </header>

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <JournalStat label="Postęp przygody" value={`${completeGoals}/${totalGoals}`} />
          <JournalStat label="Osiągnięcia" value={`${have.size}/${ACHIEVEMENTS.length}`} />
          <JournalStat label="Poziom" value={String(hud.level)} />
          <JournalStat label="Współrzędne" value={`${Math.floor(hud.pos[0])}, ${Math.floor(hud.pos[1])}, ${Math.floor(hud.pos[2])}`} />
        </div>

        <div className="mb-3 flex gap-2">
          <button className={`mc-btn !py-2 !text-sm ${tab === 'journey' ? 'ring-2 ring-inset ring-yellow-300' : ''}`} onClick={() => setTab('journey')}>Przygoda</button>
          <button className={`mc-btn !py-2 !text-sm ${tab === 'achievements' ? 'ring-2 ring-inset ring-yellow-300' : ''}`} onClick={() => setTab('achievements')}>Osiągnięcia</button>
        </div>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="journal-search">Szukaj celów</label>
          <input id="journal-search" className="mc-input !py-2 !text-sm" type="search" placeholder="Szukaj celów…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="grid grid-cols-3 gap-1 sm:min-w-[300px]">
            {([
              ['all', 'Wszystkie'], ['todo', 'Do zrobienia'], ['done', 'Ukończone'],
            ] as const).map(([id, label]) => (
              <button key={id} className={`mc-btn !px-1 !py-2 !text-xs ${filter === id ? 'ring-2 ring-inset ring-yellow-300' : ''}`} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {tab === 'journey' ? shownChapters.map((chapter) => (
            <article key={chapter.title} className="border-2 border-[#555] bg-[#b5b5b5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#292929]">{chapter.complete ? '✓ ' : ''}{chapter.title}</h3>
                  <p className="text-sm text-[#444]">{chapter.text}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-[#333]">{chapter.done}/{chapter.total}</span>
              </div>
              <div className="my-2 h-2 border border-black bg-[#555]" role="progressbar" aria-label={`Postęp: ${chapter.title}`} aria-valuemin={0} aria-valuemax={chapter.total} aria-valuenow={chapter.done}>
                <div className="h-full bg-[#4b9b35]" style={{ width: `${chapter.done / chapter.total * 100}%` }} />
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {chapter.goals.map((id) => {
                  const achievement = ACHIEVEMENTS.find((item) => item.id === id);
                  const done = have.has(id);
                  const task = CHALLENGES[id as ChallengeId];
                  return <li key={id} className={`text-sm ${done ? 'text-[#28602a]' : 'text-[#454545]'}`}>{done ? '✓' : '□'} {achievement?.title ?? id}{task && !done ? ` (${hud.challenges?.[id as ChallengeId] ?? 0}/${task.target})` : ''}</li>;
                })}
              </ul>
            </article>
          )) : achievements.map((achievement) => {
            const done = have.has(achievement.id);
            return (
              <article key={achievement.id} className={`border-2 p-3 ${done ? 'border-[#477644] bg-[#c3d7bb]' : 'border-[#777] bg-[#b5b5b5]'}`}>
                <h3 className="font-bold text-[#292929]">{done ? '✓ ' : '□ '}{achievement.title}</h3>
                <p className="text-sm text-[#444]">{achievement.text}</p>
              </article>
            );
          })}
          {((tab === 'journey' && shownChapters.length === 0) || (tab === 'achievements' && achievements.length === 0)) && <p className="py-8 text-center text-[#444]">Nie znaleziono pasujących wpisów.</p>}
        </div>
        <footer className="mt-3 flex items-center justify-between gap-3 border-t-2 border-[#777] pt-2 text-xs text-[#444]">
          <span>Ziarno świata: {hud.seed} · {hud.mode === 'creative' ? 'Kreatywny' : 'Przetrwanie'}</span>
          <span className="hidden sm:inline">Esc – powrót do gry</span>
        </footer>
      </section>
    </div>
  );
}

function JournalStat({ label, value }: { label: string; value: string }) {
  return <div className="border-2 border-[#555] bg-[#b5b5b5] px-2 py-1 text-center"><div className="text-[11px] text-[#555]">{label}</div><div className="truncate text-sm font-bold text-[#252525]" title={value}>{value}</div></div>;
}
