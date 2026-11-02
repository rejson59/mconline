import { SOUND_CATEGORIES, type SoundCategory } from '../utils/soundSettings';
import { setVolume, setSoundLevels } from '../game/audio';
import { useEffect, useMemo, useState } from 'react';
import type { Settings } from '../utils/settings';
import {
  FPS_LIMITS,
  applyPreset,
  effectiveSettings,
  manualVideoSettings,
} from '../utils/settings';
import { JavaButton, JavaPage } from './JavaMenus';
import { SkinPicker } from './SkinPicker';
import { detectDeviceProfile, PRESETS } from '../utils/performance';
import { loadSkinId, saveSkinId } from '../game/skins';

/** Functional Java-style options hierarchy; unsupported engine options aren't faked. */
export default function JavaSettings({
  settings,
  onChange,
  onClose,
  onSkin,
  overlay = false,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  onSkin?: (id: string) => void;
  overlay?: boolean;
}) {
  const [page, setPage] = useState<
    | 'main'
    | 'video'
    | 'controls'
    | 'sound'
    | 'skin'
    | 'extensions'
    | 'chat'
    | 'mouse'
    | 'accessibility'
  >('main');
  useEffect(() => {
    setVolume(settings.volume);
    setSoundLevels(settings.soundVolumes);
  }, [settings.volume, settings.soundVolumes]);
  const soundLabels: Record<SoundCategory, string> = {
    music: 'Muzyka',
    records: 'Bloki dźwiękowe',
    weather: 'Pogoda',
    blocks: 'Bloki',
    hostile: 'Wrogie stworzenia',
    neutral: 'Przyjazne stworzenia',
    players: 'Gracze',
    ambient: 'Otoczenie',
  };
  const profile = useMemo(() => detectDeviceProfile(), []);
  const video = effectiveSettings(settings, profile);
  const back = () => setPage(page === 'mouse' ? 'controls' : 'main');
  const [skin, setSkin] = useState(loadSkinId);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (page === 'main') onClose();
      else back();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [page, onClose]);
  const toggle = (key: keyof Settings, label: string) => (
    <JavaButton
      width={150}
      onClick={() =>
        page === 'video' && key === 'clouds'
          ? onChange(
              manualVideoSettings(settings, { clouds: !video.clouds }, profile),
            )
          : set({ [key]: !settings[key] })
      }
    >
      {label}:{' '}
      {(page === 'video' && key === 'clouds' ? video.clouds : settings[key])
        ? 'Wł.'
        : 'Wył.'}
    </JavaButton>
  );
  const slider = (
    key: keyof Settings,
    label: string,
    min: number,
    max: number,
    step: number,
    text: string,
  ) => (
    <label className="java-slider">
      <span>
        {label}: {text}
      </span>
      <input
        aria-label={label}
        type="range"
        aria-valuetext={text}
        min={min}
        max={max}
        step={step}
        value={
          (page === 'video' && (key === 'renderDistance' || key === 'particles')
            ? video[key]
            : settings[key]) as number
        }
        onChange={(e) =>
          page === 'video' && (key === 'renderDistance' || key === 'particles')
            ? onChange(
                manualVideoSettings(
                  settings,
                  { [key]: +e.target.value },
                  profile,
                ),
              )
            : set({ [key]: +e.target.value })
        }
      />
    </label>
  );
  return (
    <JavaPage
      optionsLayout={page === 'main'}
      overlay={overlay}
      title={
        {
          main: 'Opcje',
          chat: 'Ustawienia czatu',
          video: 'Ustawienia grafiki',
          controls: 'Sterowanie',
          sound: 'Muzyka i dźwięki',
          skin: 'Dostosowanie skórki',
          extensions: 'Rozszerzenia przeglądarkowe',
          mouse: 'Ustawienia myszy',
          accessibility: 'Ułatwienia dostępu',
        }[page]
      }
      footer={
        <JavaButton onClick={() => (page === 'main' ? onClose() : back())}>
          Gotowe
        </JavaButton>
      }
    >
      {page === 'main' ? (
        <div className="java-options-grid">
          {slider(
            'fov',
            'Pole widzenia',
            50,
            110,
            1,
            settings.fov === 70 ? 'Normalne' : `${settings.fov}`,
          )}
          <JavaButton width={150} onClick={() => setPage('skin')}>
            Dostosowanie skórki...
          </JavaButton>
          <JavaButton width={150} onClick={() => setPage('sound')}>
            Muzyka i dźwięki...
          </JavaButton>
          <JavaButton width={150} onClick={() => setPage('video')}>
            Ustawienia grafiki...
          </JavaButton>
          <JavaButton width={150} onClick={() => setPage('chat')}>
            Ustawienia czatu...
          </JavaButton>
          <JavaButton width={150} onClick={() => setPage('controls')}>
            Sterowanie...
          </JavaButton>
          <JavaButton width={150} onClick={() => setPage('accessibility')}>
            Ułatwienia dostępu...
          </JavaButton>
          <JavaButton width={150} onClick={() => setPage('extensions')}>
            Rozszerzenia...
          </JavaButton>
        </div>
      ) : page === 'video' ? (
        <div className="java-options-grid">
          {slider(
            'renderDistance',
            'Zasięg renderowania',
            2,
            14,
            1,
            `${video.renderDistance} chunków`,
          )}
          <JavaButton
            width={150}
            onClick={() => set({ guiScale: (settings.guiScale + 1) % 5 })}
          >
            Skala interfejsu: {settings.guiScale || 'Auto'}
          </JavaButton>

          <JavaButton
            width={150}
            onClick={() =>
              set({
                fpsCap:
                  FPS_LIMITS[
                    (FPS_LIMITS.indexOf(
                      settings.fpsCap as (typeof FPS_LIMITS)[number],
                    ) +
                      1) %
                      FPS_LIMITS.length
                  ],
                fpsCapUserSet: true,
              })
            }
          >
            Limit klatek: {settings.fpsCap || 'Bez limitu'}
          </JavaButton>
          {slider(
            'entityDistance',
            'Zasięg istot',
            0.5,
            1.5,
            0.1,
            `${Math.round(settings.entityDistance * 100)}%`,
          )}
          {slider(
            'brightness',
            'Jasność',
            0,
            1,
            0.01,
            `${Math.round(settings.brightness * 100)}%`,
          )}
          {slider(
            'fovEffects',
            'Efekty pola widzenia',
            0,
            1,
            0.01,
            `${Math.round(settings.fovEffects * 100)}%`,
          )}
          {slider(
            'damageTilt',
            'Zadrżenie od obrażeń',
            0,
            1,
            0.01,
            `${Math.round(settings.damageTilt * 100)}%`,
          )}
          {toggle('viewBobbing', 'Kołysanie widoku')}
          {toggle('clouds', 'Chmury')}
          <JavaButton
            width={150}
            onClick={() =>
              set({
                attackIndicator:
                  settings.attackIndicator === 'crosshair'
                    ? 'hotbar'
                    : settings.attackIndicator === 'hotbar'
                      ? 'off'
                      : 'crosshair',
              })
            }
          >
            Wskaźnik ataku:{' '}
            {
              { crosshair: 'Celownik', hotbar: 'Pasek', off: 'Wył.' }[
                settings.attackIndicator
              ]
            }
          </JavaButton>
          {slider(
            'particles',
            'Cząsteczki',
            0,
            1,
            0.01,
            `${Math.round(video.particles * 100)}%`,
          )}
          <JavaButton
            width={150}
            onClick={() => {
              if (document.fullscreenElement)
                void document.exitFullscreen?.().catch(() => {});
              else
                void document.documentElement
                  .requestFullscreen?.()
                  .catch(() => {});
            }}
          >
            Pełny ekran
          </JavaButton>
        </div>
      ) : page === 'chat' ? (
        <div className="java-options-grid">
          {toggle('chatVisible', 'Powiadomienia czatu')}
          {slider(
            'chatOpacity',
            'Przezroczystość tekstu',
            0,
            1,
            0.05,
            `${Math.round(settings.chatOpacity * 100)}%`,
          )}
          {slider(
            'chatBackground',
            'Krycie tła',
            0,
            1,
            0.05,
            `${Math.round(settings.chatBackground * 100)}%`,
          )}
          {slider(
            'chatScale',
            'Skala czatu',
            0.5,
            1,
            0.05,
            `${Math.round(settings.chatScale * 100)}%`,
          )}
          {slider(
            'chatWidth',
            'Szerokość czatu',
            0.3,
            1,
            0.05,
            `${Math.round(settings.chatWidth * 100)}%`,
          )}
          {slider(
            'chatLines',
            'Wiersze czatu',
            1,
            10,
            1,
            `${settings.chatLines}`,
          )}
          <div
            data-testid="chat-preview"
            style={{
              gridColumn: '1 / -1',
              width: `${settings.chatWidth * 100}%`,
              fontSize: 12 * settings.chatScale,
              opacity: settings.chatVisible ? settings.chatOpacity : 0.25,
              background: `rgba(0,0,0,${settings.chatBackground})`,
              padding: 4,
            }}
          >
            Podgląd: &lt;Budowniczy&gt; Witaj w mieście!
          </div>
          <p className="java-muted" style={{ gridColumn: '1 / -1' }}>
            Zmieniają powiadomienia w HUD. T i / nadal otwierają czat oraz
            komendy. Zasięg istot zmienia widoczność, nie symulację.
          </p>
        </div>
      ) : page === 'sound' ? (
        <div className="java-options-grid">
          <div className="java-master-volume">
            {slider(
              'volume',
              'Głośność główna',
              0,
              1,
              0.01,
              `${Math.round(settings.volume * 100)}%`,
            )}
          </div>
          {SOUND_CATEGORIES.map((category) => (
            <label key={category} className="java-slider">
              <span>
                {soundLabels[category]}:{' '}
                {Math.round(settings.soundVolumes[category] * 100)}%
              </span>
              <input
                aria-label={soundLabels[category]}
                aria-valuetext={`${Math.round(settings.soundVolumes[category] * 100)}%`}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.soundVolumes[category]}
                onChange={(e) =>
                  set({
                    soundVolumes: {
                      ...settings.soundVolumes,
                      [category]: +e.target.value,
                    },
                  })
                }
              />
            </label>
          ))}
          <p className="java-muted" style={{ gridColumn: '1 / -1' }}>
            Oryginalne efekty Java 1.20.4. Muzyka jest własną kompozycją, nie
            ścieżką Minecrafta. Kanał bloków dźwiękowych działa; szaf grających
            jeszcze nie ma.
          </p>
        </div>
      ) : page === 'controls' ? (
        <div className="java-options-grid">
          <JavaButton width={150} onClick={() => setPage('mouse')}>
            Ustawienia myszy...
          </JavaButton>
          {toggle('autoJump', 'Automatyczny skok')}
          <JavaButton
            width={150}
            onClick={() =>
              set({
                controlMode:
                  settings.controlMode === 'auto'
                    ? 'desktop'
                    : settings.controlMode === 'desktop'
                      ? 'touch'
                      : 'auto',
              })
            }
          >
            Sterowanie:{' '}
            {settings.controlMode === 'auto'
              ? 'Auto'
              : settings.controlMode === 'desktop'
                ? 'Mysz'
                : 'Dotyk'}
          </JavaButton>
          <div className="java-key-list">
            <p>W / A / S / D — ruch</p>
            <p>Spacja — skok / 2× lot</p>
            <p>Shift — skradanie</p>
            <p>Ctrl / R / W×2 — sprint</p>
            <p>E — ekwipunek</p>
            <p>F — zamień ręce</p>
            <p>Q / Ctrl+Q — wyrzuć</p>
            <p>T / / — czat / komenda</p>
            <p>F3 — debugowanie</p>
            <p>Esc — powrót / menu gry</p>
          </div>
        </div>
      ) : page === 'mouse' ? (
        <div className="java-options-grid">
          {slider(
            'sensitivity',
            'Czułość myszy',
            0.2,
            3,
            0.05,
            `${Math.round(settings.sensitivity * 100)}%`,
          )}
          {toggle('invertMouse', 'Odwróć mysz')}
          {slider(
            'scrollSensitivity',
            'Czułość przewijania',
            0.01,
            10,
            0.01,
            settings.scrollSensitivity.toFixed(2),
          )}
          {toggle('discreteScroll', 'Przewij. zrównoważone')}
        </div>
      ) : page === 'accessibility' ? (
        <div className="java-options-grid">
          {slider(
            'fovEffects',
            'Efekty pola widzenia',
            0,
            1,
            0.01,
            `${Math.round(settings.fovEffects * 100)}%`,
          )}
          {slider(
            'damageTilt',
            'Zadrżenie od obrażeń',
            0,
            1,
            0.01,
            `${Math.round(settings.damageTilt * 100)}%`,
          )}
          {slider(
            'glintSpeed',
            'Prędkość poświaty',
            0,
            1,
            0.01,
            `${Math.round(settings.glintSpeed * 100)}%`,
          )}
          {slider(
            'glintStrength',
            'Siła poświaty',
            0,
            1,
            0.01,
            `${Math.round(settings.glintStrength * 100)}%`,
          )}
          {slider(
            'notificationDisplayTime',
            'Czas wyświetl. powiad.',
            0.5,
            10,
            0.5,
            `${settings.notificationDisplayTime}×`,
          )}
          {toggle('viewBobbing', 'Kołysanie widoku')}
          {toggle('autoJump', 'Automatyczny skok')}
          <p className="java-muted" style={{ gridColumn: '1 / -1' }}>
            Połysk dotyczy zaklętych przedmiotów w interfejsie. Czas wyświetl. powiad.
            zmienia długość pokazywania postępów.
          </p>
        </div>
      ) : page === 'skin' ? (
        <SkinPicker
          value={skin}
          onChange={(id) => {
            const selected = saveSkinId(id);
            setSkin(selected);
            onSkin?.(selected);
          }}
        />
      ) : (
        <div className="java-options-grid">
          <JavaButton
            width={150}
            onClick={() => {
              const choices = [
                'auto',
                'potato',
                'low',
                'medium',
                'high',
              ] as const;
              const next =
                choices[
                  (choices.indexOf(settings.quality) + 1) % choices.length
                ];
              onChange(
                next === 'auto'
                  ? { ...settings, quality: 'auto' }
                  : {
                      ...applyPreset(settings, next),
                      fpsCap: settings.fpsCapUserSet
                        ? settings.fpsCap
                        : PRESETS[next].fpsCap,
                    },
              );
            }}
          >
            Profil wydajności:{' '}
            {settings.quality === 'auto'
              ? 'Auto'
              : PRESETS[settings.quality].label}
          </JavaButton>
          {toggle('minimap', 'Minimapa')}
          {toggle('showFps', 'Licznik FPS')}
          {toggle('autoAttack', 'Automatyczny atak')}
          {toggle('autoQuality', 'Automatyczna jakość')}
          {toggle('dynamicResolution', 'Dynamiczna rozdzielczość')}
          {toggle('lod', 'Odległy teren')}
          {toggle('haptics', 'Wibracje')}
          {toggle('joystickFixed', 'Stały drążek')}
          <JavaButton
            width={150}
            onClick={() =>
              set({
                touchMode: settings.touchMode === 'tap' ? 'buttons' : 'tap',
              })
            }
          >
            Dotyk: {settings.touchMode === 'tap' ? 'Gesty' : 'Przyciski'}
          </JavaButton>
          {slider(
            'touchScale',
            'Rozmiar przycisków',
            0.8,
            1.25,
            0.05,
            `${Math.round(settings.touchScale * 100)}%`,
          )}
        </div>
      )}
    </JavaPage>
  );
}
