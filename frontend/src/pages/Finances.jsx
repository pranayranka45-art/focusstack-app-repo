import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Finances() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'craft',
    amount: '',
    kind: 'expense',
    note: '',
  });

  async function load() {
    const [f, docs] = await Promise.all([api.getFinance(), api.getDocuments('finance')]);
    setEntries(f);
    setNotes(docs);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.amount) return;
    await api.createFinance({ ...form, amount: Number(form.amount) });
    setForm({ ...form, amount: '', note: '' });
    load();
  }

  const income = entries.filter((x) => x.kind === 'income').reduce((s, x) => s + x.amount, 0);
  const expense = entries.filter((x) => x.kind === 'expense').reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-serif text-3xl">Personal finances</h2>
        <p className="mt-1 text-muted">
          Track the numbers, then write the month so the spreadsheet has a pulse.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-muted">Income</p>
          <p className="font-serif text-3xl text-emerald-600">{income.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Spent</p>
          <p className="font-serif text-3xl">{expense.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Net</p>
          <p className="font-serif text-3xl">{(income - expense).toFixed(2)}</p>
        </div>
      </div>

      <form onSubmit={add} className="card grid gap-3 md:grid-cols-5">
        <input
          className="input"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          className="input"
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          className="input"
          type="number"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <select
          className="input"
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <button className="btn-primary" type="submit">
          Add
        </button>
        <input
          className="input md:col-span-5"
          placeholder="Note — why this mattered"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="pb-2">Date</th>
              <th>Kind</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2">{row.date}</td>
                <td>{row.kind}</td>
                <td>{row.category}</td>
                <td>{row.amount.toFixed(2)}</td>
                <td className="text-muted">{row.note}</td>
                <td>
                  <button className="text-xs text-red-500" onClick={() => api.deleteFinance(row.id).then(load)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="py-6 text-sm text-muted">No entries yet.</p>}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-xl">Money stories</h3>
          <button
            className="btn-secondary text-sm"
            onClick={async () => {
              const doc = await api.createDocument({
                title: 'Monthly money story',
                content: '# This month\n\n',
                doc_type: 'finance',
              });
              navigate(`/write/${doc.id}`);
            }}
          >
            New story
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <button
              key={n.id}
              className="card text-left"
              onClick={() => navigate(`/write/${n.id}`)}
            >
              <p className="font-medium">{n.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{n.content.slice(0, 140)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
