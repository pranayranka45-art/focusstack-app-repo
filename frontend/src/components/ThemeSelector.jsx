import { useTheme } from '../context/ThemeContext';

const MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">Appearance</p>
      <div className="flex gap-1 rounded-xl bg-elevated p-1">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTheme(id)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs transition ${
              theme === id
                ? 'bg-brand-500/20 text-brand-600 font-medium dark-active'
                : 'text-muted hover:text-ink hover:bg-hover'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
