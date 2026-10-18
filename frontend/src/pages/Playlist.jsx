import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { createRoom } from '../audio/engine';
import { toEmbed } from '../audio/embed';
import { useAuth } from '../context/AuthContext';

const FALLBACK_TRACKS = [
  { id: 'lofi', title: 'Loft Hour', artist: 'FocusStack Radio', hint: 'Warm keys, slow pulse' },
  { id: 'rain', title: 'Window Rain', artist: 'Weather Desk', hint: 'Soft storm for long drafts' },
  { id: 'cafe', title: 'Corner Table', artist: 'Night Shift Café', hint: 'Cups, chairs, distant talk' },
  { id: 'forest', title: 'Early Trail', artist: 'Field Notes', hint: 'Birds and low wind' },
  { id: 'piano', title: 'Unfinished Prelude', artist: 'Practice Room', hint: 'Sparse piano' },
  { id: 'train', title: 'Night Express', artist: 'Carriage 4', hint: 'Rumble and rails' },
];

const LOOKAHEAD = 3; // seconds of music queued ahead (background tabs only wake timers ~1/s)

function SavedTrack({ track, open, onToggle, onRemove }) {
  const embed = toEmbed(track.url);
  return (
    <li className="border-t border-line">
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <button className="min-w-0 flex-1 text-left" onClick={onToggle} disabled={!embed}>
          <span className="block truncate">{track.title}</span>
          <span className="text-xs text-muted">{embed ? embed.provider : 'Unsupported link'}</span>
        </button>
        {embed && (
          <button className="btn-secondary px-3 py-1.5 text-sm" onClick={onToggle}>
            {open ? 'Close' : 'Play'}
          </button>
        )}
        <button className="px-2 text-muted hover:text-red-500" onClick={onRemove} aria-label={`Remove ${track.title}`} title="Remove">
          ✕
        </button>
      </div>
      {open && embed?.kind === 'iframe' && (
        <iframe
          title={track.title}
          src={embed.src}
          height={embed.height}
          className="w-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      {open && embed?.kind === 'audio' && (
        <div className="px-6 pb-4">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls autoPlay src={embed.src} className="w-full" />
        </div>
      )}
    </li>
  );
}

export default function Playlist() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState(FALLBACK_TRACKS);
  const [current, setCurrent] = useState(FALLBACK_TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [saved, setSaved] = useState([]);
  const [openSaved, setOpenSaved] = useState(null);
  const [form, setForm] = useState({ title: '', url: '' });
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(false);

  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const roomRef = useRef(null);
  const timerRef = useRef(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

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
  }, []);

  useEffect(() => {
    if (!user) {
      setSaved([]);
      return;
    }
    api.getSavedTracks().then(setSaved).catch(console.error);
  }, [user]);

  const stopRoom = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    roomRef.current?.stop();
    roomRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(
    () => () => {
      stopRoom();
      ctxRef.current?.close?.();
    },
    [stopRoom]
  );

  async function play(id) {
    stopRoom();
    setOpenSaved(null);
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = volumeRef.current;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    const room = createRoom(ctx, id, masterRef.current);
    roomRef.current = room;
    room.schedule(ctx.currentTime + LOOKAHEAD);
    timerRef.current = setInterval(() => room.schedule(ctx.currentTime + LOOKAHEAD), 250);
    setCurrent(id);
    setPlaying(true);
  }

  function step(delta) {
    const i = tracks.findIndex((t) => t.id === current);
    const next = tracks[(i + delta + tracks.length) % tracks.length];
    if (playing) play(next.id);
    else setCurrent(next.id);
  }

  useEffect(() => {
    const ctx = ctxRef.current;
    if (masterRef.current && ctx) masterRef.current.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
  }, [volume]);

  function toggleSaved(id) {
    if (openSaved === id) {
      setOpenSaved(null);
      return;
    }
    stopRoom();
    setOpenSaved(id);
  }

  async function addTrack(e) {
    e.preventDefault();
    setFormError('');
    const embed = toEmbed(form.url);
    if (!embed) {
      setFormError('Paste a YouTube, Spotify or SoundCloud link, or a direct https link to an .mp3 file.');
      return;
    }
    setAdding(true);
    try {
      const created = await api.saveTrack({
        title: form.title.trim() || `${embed.provider} link`,
        url: form.url.trim(),
      });
      setSaved((list) => [...list, created]);
      setForm({ title: '', url: '' });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeTrack(id) {
    await api.deleteSavedTrack(id).catch(console.error);
    setSaved((list) => list.filter((t) => t.id !== id));
    if (openSaved === id) setOpenSaved(null);
  }

  const track = tracks.find((t) => t.id === current) || tracks[0];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h2 className="font-serif text-3xl">Writing playlist</h2>
        <p className="mt-1 text-muted">
          Six rooms of original music, played live in your browser: chords, bass, drums and weather. No ads,
          and no two listens are exactly alike. Add your own YouTube, Spotify or SoundCloud links below.
        </p>
      </header>

      <div className="card overflow-hidden">
        <div className="bg-elevated px-6 py-10">
          <p className="text-xs uppercase tracking-[0.25em] text-muted">{playing ? 'Now playing' : 'Ready'}</p>
          <h3 className="mt-2 font-serif text-4xl">{track.title}</h3>
          <p className="mt-1 text-muted">{track.artist} · {track.hint}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="btn-secondary px-3" onClick={() => step(-1)} aria-label="Previous room">⏮</button>
            {playing ? (
              <button className="btn-primary w-24" onClick={stopRoom}>Pause</button>
            ) : (
              <button className="btn-primary w-24" onClick={() => play(current)}>Play</button>
            )}
            <button className="btn-secondary px-3" onClick={() => step(1)} aria-label="Next room">⏭</button>
            <label className="ml-2 flex items-center gap-2 text-sm text-muted">
              Volume
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-32" />
            </label>
          </div>
        </div>
        <ol>
          {tracks.map((t, i) => (
            <li key={t.id}>
              <button
                onClick={() => play(t.id)}
                className={`flex w-full items-center justify-between border-t border-line px-6 py-4 text-left hover:bg-hover ${current === t.id ? 'bg-hover' : ''}`}
              >
                <span>
                  <span className="mr-3 text-muted">{String(i + 1).padStart(2, '0')}</span>
                  {t.title}
                  <span className="ml-2 text-sm text-muted">{t.artist}</span>
                </span>
                {current === t.id && playing && <span className="animate-pulse text-brand-500">●</span>}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="card overflow-hidden !p-0">
        <div className="space-y-3 px-6 py-5">
          <h3 className="font-serif text-2xl">Your tracks</h3>
          {user ? (
            <form onSubmit={addTrack} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                <input className="input" placeholder="Title (optional)" maxLength={200} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                <input className="input" placeholder="Paste a YouTube, Spotify or SoundCloud link" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
                <button className="btn-primary disabled:opacity-60" disabled={adding || !form.url.trim()}>Add</button>
              </div>
              {formError && <p role="alert" className="text-sm text-red-500">{formError}</p>}
            </form>
          ) : (
            <p className="text-sm text-muted">
              <Link to="/login" className="text-brand-500 hover:underline">Log in</Link> to save your own playlists, albums and tracks here.
            </p>
          )}
        </div>
        {user && saved.length === 0 && (
          <p className="border-t border-line px-6 py-4 text-sm text-muted">
            Nothing saved yet. Try a lo-fi livestream, a Spotify playlist or an album you write to.
          </p>
        )}
        <ul>
          {saved.map((t) => (
            <SavedTrack key={t.id} track={t} open={openSaved === t.id} onToggle={() => toggleSaved(t.id)} onRemove={() => removeTrack(t.id)} />
          ))}
        </ul>
      </div>
    </div>
  );
}
