import { useEffect, useState } from 'react';
import { api } from '../api';

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in_progress', 'done'];

const priorityColors = {
  low: 'bg-white/10 text-white/60',
  medium: 'bg-amber-500/20 text-amber-300',
  high: 'bg-red-500/20 text-red-300',
};

const statusLabels = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    estimated_pomodoros: 1,
  });

  function loadTasks() {
    api.getTasks().then(setTasks).catch(console.error);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await api.createTask(form);
      setForm({ title: '', description: '', priority: 'medium', estimated_pomodoros: 1 });
      setShowForm(false);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStatusChange(id, status) {
    try {
      await api.updateTask(id, { status });
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteTask(id);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  }

  const filtered =
    filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
          <p className="mt-1 text-white/50">
            Organize work, set priorities, and track pomodoros per task.
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <input
            className="input"
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-4">
            <select
              className="input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)} priority
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              max="20"
              className="input w-40"
              value={form.estimated_pomodoros}
              onChange={(e) =>
                setForm({ ...form, estimated_pomodoros: Number(e.target.value) })
              }
            />
            <span className="flex items-center text-sm text-white/40">pomodoros</span>
          </div>
          <button type="submit" className="btn-primary">
            Create Task
          </button>
        </form>
      )}

      <div className="flex gap-2">
        {['all', ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === s
                ? 'bg-brand-500/20 text-brand-300'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {s === 'all' ? 'All' : statusLabels[s]} ({counts[s] ?? counts.all})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card py-12 text-center text-white/40">
            No tasks yet. Create one to boost your productivity.
          </div>
        ) : (
          filtered.map((task) => (
            <div
              key={task.id}
              className="card flex items-start justify-between gap-4 transition hover:border-white/20"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3
                    className={`font-medium ${
                      task.status === 'done' ? 'text-white/40 line-through' : ''
                    }`}
                  >
                    {task.title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </div>
                {task.description && (
                  <p className="mt-1 text-sm text-white/50">{task.description}</p>
                )}
                <p className="mt-2 text-xs text-white/30">
                  🍅 {task.completed_pomodoros}/{task.estimated_pomodoros} pomodoros
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="rounded-lg border border-white/10 bg-surface-900 px-2 py-1.5 text-xs"
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="rounded-lg px-2 py-1.5 text-xs text-red-400/70 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
