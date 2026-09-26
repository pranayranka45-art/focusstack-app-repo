import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

const PRESETS = [
  { type: 'focus', label: 'Focus', minutes: 25, color: 'brand' },
  { type: 'short_break', label: 'Short Break', minutes: 5, color: 'emerald' },
  { type: 'long_break', label: 'Long Break', minutes: 15, color: 'violet' },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Focus() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState('');
  const [preset, setPreset] = useState(PRESETS[0]);
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    api.getTasks().then(setTasks).catch(console.error);
  }, []);

  useEffect(() => {
    setSecondsLeft(preset.minutes * 60);
    setRunning(false);
    setSessionId(null);
  }, [preset]);

  const handleComplete = useCallback(async () => {
    setRunning(false);
    if (sessionId) {
      try {
        await api.completeFocusSession(sessionId);
        if (preset.type === 'focus') setCompletedCount((c) => c + 1);
      } catch (err) {
        console.error(err);
      }
    }
    setSessionId(null);
    setSecondsLeft(preset.minutes * 60);
  }, [sessionId, preset]);

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, handleComplete]);

  async function handleStart() {
    if (running) return;
    try {
      const session = await api.startFocusSession({
        task_id: selectedTask ? Number(selectedTask) : null,
        duration_minutes: preset.minutes,
        session_type: preset.type,
      });
      setSessionId(session.id);
      setRunning(true);
    } catch (err) {
      console.error(err);
    }
  }

  function handlePause() {
    setRunning(false);
  }

  function handleReset() {
    setRunning(false);
    setSessionId(null);
    setSecondsLeft(preset.minutes * 60);
  }

  const progress = 1 - secondsLeft / (preset.minutes * 60);
  const activeTasks = tasks.filter((t) => t.status !== 'done');

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Focus Timer</h2>
        <p className="mt-1 text-white/50">
          Pomodoro-style sessions to improve deep work and concentration.
        </p>
      </header>

      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.type}
            onClick={() => setPreset(p)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              preset.type === p.type
                ? 'bg-brand-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="card flex flex-col items-center py-12">
        <div className="relative">
          <svg className="h-64 w-64 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 283} 283`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-6xl font-bold tabular-nums tracking-tight">
              {formatTime(secondsLeft)}
            </p>
            <p className="mt-2 text-sm text-white/50">{preset.label} session</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          {!running ? (
            <button onClick={handleStart} className="btn-primary px-8 py-3 text-lg">
              {secondsLeft < preset.minutes * 60 ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button onClick={handlePause} className="btn-secondary px-8 py-3 text-lg">
              Pause
            </button>
          )}
          <button onClick={handleReset} className="btn-secondary px-6 py-3">
            Reset
          </button>
        </div>

        <p className="mt-6 text-sm text-white/40">
          {completedCount} focus session{completedCount !== 1 ? 's' : ''} completed this visit
        </p>
      </div>

      <div className="card">
        <label className="text-sm font-medium text-white/70">Link to task (optional)</label>
        <select
          className="input mt-2"
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
          disabled={running}
        >
          <option value="">No task — free focus</option>
          {activeTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
