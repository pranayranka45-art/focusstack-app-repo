import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const FALLBACK_TRACKS = [
  { id: 'lofi', title: 'Loft Hour', artist: 'FocusStack Radio', hint: 'Warm keys, slow pulse' },
  { id: 'rain', title: 'Window Rain', artist: 'Weather Desk', hint: 'Soft storm for long drafts' },
  { id: 'cafe', title: 'Corner Table', artist: 'Night Shift Café', hint: 'Cups, chairs, distant talk' },
  { id: 'forest', title: 'Early Trail', artist: 'Field Notes', hint: 'Birds and low wind' },
  { id: 'piano', title: 'Unfinished Prelude', artist: 'Practice Room', hint: 'Sparse piano' },
  { id: 'train', title: 'Night Express', artist: 'Carriage 4', hint: 'Rumble and rails' },
];

function noiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function startTrack(ctx, id, master) {
  const nodes = [];
  const stop = () => nodes.forEach((n) => {
    try {
      n.stop?.();
      n.disconnect?.();
    } catch {
      /* already stopped */
    }
  });

  function osc(type, freq, gainVal, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gainVal;
    o.connect(g).connect(dest);
    o.start();
    nodes.push(o, g);
    return { o, g };
  }

  function noise(gainVal, dest, filterType = 'lowpass', freq = 800) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(f).connect(g).connect(dest);
    src.start();
    nodes.push(src, f, g);
  }

  if (id === 'lofi') {
    osc('triangle', 110, 0.08, master);
    osc('sine', 164.8, 0.05, master);
    const lfo = osc('sine', 0.4, 1, ctx.createGain());
    lfo.g.gain.value = 0;
    noise(0.03, master, 'lowpass', 600);
  } else if (id === 'rain') {
    noise(0.22, master, 'highpass', 900);
    noise(0.08, master, 'lowpass', 400);
  } else if (id === 'cafe') {
    noise(0.05, master, 'bandpass', 1200);
    osc('sine', 90, 0.02, master);
  } else if (id === 'forest') {
    noise(0.04, master, 'highpass', 2000);
    osc('sine', 220, 0.015, master);
  } else if (id === 'piano') {
    osc('sine', 261.6, 0.07, master);
    osc('sine', 329.6, 0.04, master);
    osc('triangle', 130.8, 0.03, master);
  } else if (id === 'train') {
    noise(0.12, master, 'lowpass', 300);
    osc('sine', 45, 0.05, master);
  }

  return stop;
}

export default function Playlist() {
  const [tracks, setTracks] = useState(FALLBACK_TRACKS);
  const [current, setCurrent] = useState(FALLBACK_TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const audio = useRef(null);

  useEffect(() => {
    api
      .getPlaylist()
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          setTracks(list);
          setCurrent((id) => (list.some((t) => t.id === id) ? id : list[0].id));
        }
      })
      .catch(console.error);
    return () => {
      audio.current?.stop?.();
      audio.current?.ctx?.close?.();
    };
  }, []);

  async function play(id) {
    audio.current?.stop?.();
    const ctx = audio.current?.ctx && audio.current.ctx.state !== 'closed'
      ? audio.current.ctx
      : new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    const stop = startTrack(ctx, id, master);
    audio.current = { ctx, master, stop };
    setCurrent(id);
    setPlaying(true);
  }

  function pause() {
    audio.current?.stop?.();
    setPlaying(false);
  }

  useEffect(() => {
    if (audio.current?.master) audio.current.master.gain.value = volume;
  }, [volume]);

  const track = tracks.find((t) => t.id === current) || tracks[0];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h2 className="font-serif text-3xl">Writing playlist</h2>
        <p className="mt-1 text-muted">
          Six rooms of generated sound — no accounts, no ads, just enough texture to stay on the page.
        </p>
      </header>

      <div className="card overflow-hidden">
        <div className="bg-elevated px-6 py-10">
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Now playing</p>
          <h3 className="mt-2 font-serif text-4xl">{track.title}</h3>
          <p className="mt-1 text-muted">{track.artist} · {track.hint}</p>
          <div className="mt-6 flex items-center gap-4">
            {playing ? (
              <button className="btn-primary" onClick={pause}>Pause</button>
            ) : (
              <button className="btn-primary" onClick={() => play(current)}>Play</button>
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-40"
            />
          </div>
        </div>
        <ol>
          {tracks.map((t, i) => (
            <li key={t.id}>
              <button
                onClick={() => play(t.id)}
                className={`flex w-full items-center justify-between border-t border-line px-6 py-4 text-left hover:bg-hover ${
                  current === t.id ? 'bg-hover' : ''
                }`}
              >
                <span>
                  <span className="mr-3 text-muted">{String(i + 1).padStart(2, '0')}</span>
                  {t.title}
                  <span className="ml-2 text-sm text-muted">{t.artist}</span>
                </span>
                {current === t.id && playing && <span className="text-brand-500">●</span>}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
