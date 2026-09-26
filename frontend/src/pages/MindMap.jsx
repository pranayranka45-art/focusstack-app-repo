import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1'];

const EMPTY = {
  nodes: [{ id: 'root', x: 360, y: 220, text: 'Center idea', color: '#0ea5e9' }],
  edges: [],
};

function parseMap(content) {
  try {
    const data = JSON.parse(content || '{}');
    if (Array.isArray(data.nodes)) return data;
  } catch {
    /* blank */
  }
  return structuredClone(EMPTY);
}

export default function MindMap() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [maps, setMaps] = useState([]);
  const [graph, setGraph] = useState(EMPTY);
  const [selected, setSelected] = useState('root');
  const drag = useRef(null);
  const saveTimer = useRef(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  async function refresh() {
    const list = await api.getDocuments('mindmap');
    setMaps(list);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) return;
    api.getDocument(id).then((d) => {
      const parsed = parseMap(d.content);
      setGraph(parsed);
      setSelected(parsed.nodes[0]?.id || null);
    });
  }, [id]);

  function persist(next) {
    setGraph(next);
    if (!id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.updateDocument(id, { content: JSON.stringify(next) }).catch(console.error);
    }, 400);
  }

  async function create() {
    const created = await api.createDocument({
      title: 'New map',
      content: JSON.stringify(EMPTY),
      doc_type: 'mindmap',
      language: 'json',
    });
    await refresh();
    navigate(`/maps/${created.id}`);
  }

  function addNode() {
    const parent = selected || graph.nodes[0]?.id;
    const idn = `n${Date.now()}`;
    const origin = graph.nodes.find((n) => n.id === parent) || graph.nodes[0];
    const node = {
      id: idn,
      x: origin.x + 140,
      y: origin.y + 40,
      text: 'New thought',
      color: COLORS[graph.nodes.length % COLORS.length],
    };
    persist({
      nodes: [...graph.nodes, node],
      edges: [...graph.edges, { from: parent, to: idn }],
    });
    setSelected(idn);
  }

  function updateText(text) {
    persist({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === selected ? { ...n, text } : n)),
    });
  }

  function onPointerDown(e, node) {
    const svg = e.currentTarget.closest('svg');
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM().inverse();
    const loc = pt.matrixTransform(ctm);
    drag.current = { id: node.id, dx: loc.x - node.x, dy: loc.y - node.y };
    setSelected(node.id);
  }

  function onPointerMove(e) {
    if (!drag.current) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const { id: nid, dx, dy } = drag.current;
    persist({
      ...graphRef.current,
      nodes: graphRef.current.nodes.map((n) =>
        n.id === nid ? { ...n, x: loc.x - dx, y: loc.y - dy } : n
      ),
    });
  }

  const current = graph.nodes.find((n) => n.id === selected);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">Mind maps</h2>
          <p className="text-sm text-muted">Drag nodes. Add thoughts. The center can stay messy.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={create}>
            New map
          </button>
          {id && (
            <button className="btn-secondary" onClick={addNode}>
              Add node
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {maps.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate(`/maps/${m.id}`)}
            className={`rounded-full border border-line px-3 py-1 text-sm ${id === m.id ? 'bg-elevated' : ''}`}
          >
            {m.title}
          </button>
        ))}
      </div>

      {!id ? (
        <div className="card py-16 text-center text-muted">Open a map or create one from Templates.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <svg
            viewBox="0 0 720 480"
            className="card h-[480px] w-full cursor-grab"
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerLeave={() => {
              drag.current = null;
            }}
          >
            {graph.edges.map((e, i) => {
              const a = graph.nodes.find((n) => n.id === e.from);
              const b = graph.nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="currentColor"
                  strokeOpacity="0.25"
                />
              );
            })}
            {graph.nodes.map((n) => (
              <g key={n.id} onPointerDown={(ev) => onPointerDown(ev, n)}>
                <circle cx={n.x} cy={n.y} r={selected === n.id ? 28 : 24} fill={n.color} opacity="0.9" />
                <text
                  x={n.x}
                  y={n.y + 42}
                  textAnchor="middle"
                  fontSize="12"
                  fill="currentColor"
                >
                  {n.text.slice(0, 28)}
                </text>
              </g>
            ))}
          </svg>
          <div className="card space-y-3">
            <p className="text-sm text-muted">Selected thought</p>
            <textarea
              className="input min-h-[120px] resize-none"
              value={current?.text || ''}
              onChange={(e) => updateText(e.target.value)}
            />
            <input
              className="input"
              defaultValue={maps.find((m) => m.id === id)?.title}
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  api.updateDocument(id, { title: e.target.value }).then(refresh);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
