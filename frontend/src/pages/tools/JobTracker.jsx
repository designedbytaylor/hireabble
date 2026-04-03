import { useState, useCallback } from 'react';
import { Kanban, Plus, Download, Trash2, GripVertical, X } from 'lucide-react';
import { DndContext, DragOverlay, useDroppable, useDraggable, PointerSensor, useSensor, useSensors, rectIntersection } from '@dnd-kit/core';
import { Button } from '../../components/ui/button';
import ToolLayout from './ToolLayout';

const COLUMNS = [
  { id: 'saved', label: 'Saved', color: 'hsl(215, 70%, 55%)' },
  { id: 'applied', label: 'Applied', color: 'hsl(173, 58%, 39%)' },
  { id: 'phoneScreen', label: 'Phone Screen', color: 'hsl(280, 60%, 55%)' },
  { id: 'interview', label: 'Interview', color: 'hsl(35, 90%, 55%)' },
  { id: 'offer', label: 'Offer', color: 'hsl(140, 60%, 45%)' },
  { id: 'rejected', label: 'Rejected', color: 'hsl(0, 70%, 55%)' },
];

const LS_KEY = 'hireabble-job-tracker';

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY));
    if (d && typeof d === 'object') return d;
  } catch {}
  return { saved: [], applied: [], phoneScreen: [], interview: [], offer: [], rejected: [] };
}

function saveData(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function DroppableColumn({ id, label, color, children, count }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[200px] rounded-xl border transition-colors ${isOver ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-background/50'}`}>
      <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground ml-auto">{count}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[100px]">{children}</div>
    </div>
  );
}

function DraggableCard({ job, columnId, onDelete, onMove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { columnId },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 } : {};

  return (
    <div ref={setNodeRef} style={style} className="glass-card rounded-lg p-3 text-sm group">
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="mt-0.5 cursor-grab active:cursor-grabbing hidden md:block">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{job.company}</p>
          <p className="text-xs text-muted-foreground truncate">{job.title}</p>
          {job.date && <p className="text-xs text-muted-foreground mt-1">{job.date}</p>}
        </div>
        <button onClick={() => onDelete(job.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3 h-3 text-red-400" />
        </button>
      </div>
      {/* Mobile: move via select */}
      <select className="md:hidden w-full mt-2 text-xs rounded border border-border bg-background px-1 py-0.5"
        value={columnId} onChange={e => onMove(job.id, columnId, e.target.value)}>
        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </div>
  );
}

function CardOverlay({ job }) {
  if (!job) return null;
  return (
    <div className="glass-card rounded-lg p-3 text-sm shadow-xl border-primary/30 w-[200px]">
      <p className="font-medium truncate">{job.company}</p>
      <p className="text-xs text-muted-foreground truncate">{job.title}</p>
    </div>
  );
}

export default function JobTracker() {
  const [data, setData] = useState(loadData);
  const [showDialog, setShowDialog] = useState(false);
  const [newJob, setNewJob] = useState({ company: '', title: '', url: '', notes: '' });
  const [activeJob, setActiveJob] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const updateData = useCallback((next) => {
    setData(next);
    saveData(next);
  }, []);

  const addJob = (e) => {
    e.preventDefault();
    const job = { ...newJob, id: uid(), date: new Date().toLocaleDateString('en-CA') };
    const next = { ...data, saved: [...data.saved, job] };
    updateData(next);
    setNewJob({ company: '', title: '', url: '', notes: '' });
    setShowDialog(false);
  };

  const deleteJob = useCallback((jobId) => {
    const next = {};
    for (const col of COLUMNS) {
      next[col.id] = (data[col.id] || []).filter(j => j.id !== jobId);
    }
    updateData(next);
  }, [data, updateData]);

  const moveJob = useCallback((jobId, fromCol, toCol) => {
    if (fromCol === toCol) return;
    const job = (data[fromCol] || []).find(j => j.id === jobId);
    if (!job) return;
    const next = { ...data };
    next[fromCol] = (data[fromCol] || []).filter(j => j.id !== jobId);
    next[toCol] = [...(data[toCol] || []), job];
    updateData(next);
  }, [data, updateData]);

  const handleDragStart = (event) => {
    const { active } = event;
    const colId = active.data.current?.columnId;
    const job = (data[colId] || []).find(j => j.id === active.id);
    setActiveJob(job || null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveJob(null);
    if (!over) return;
    const fromCol = active.data.current?.columnId;
    const toCol = over.id;
    if (fromCol && toCol && fromCol !== toCol && COLUMNS.some(c => c.id === toCol)) {
      moveJob(active.id, fromCol, toCol);
    }
  };

  const exportCSV = () => {
    let csv = 'Stage,Company,Title,URL,Notes,Date\n';
    for (const col of COLUMNS) {
      for (const job of (data[col.id] || [])) {
        const row = [col.label, job.company, job.title, job.url || '', job.notes || '', job.date || '']
          .map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',');
        csv += row + '\n';
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-tracker-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalJobs = COLUMNS.reduce((sum, c) => sum + (data[c.id]?.length || 0), 0);
  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <ToolLayout title="Job Search Tracker" description="Track your job applications with a drag-and-drop Kanban board. Data saved locally in your browser.">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{totalJobs} job{totalJobs !== 1 ? 's' : ''} tracked</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={totalJobs === 0}>
            <Download className="w-3 h-3 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="w-3 h-3 mr-1" /> Add Job
          </Button>
        </div>
      </div>

      {/* Add Job Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDialog(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold font-['Outfit']">Add Job</h3>
              <button onClick={() => setShowDialog(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={addJob} className="space-y-3">
              <div><label className="block text-xs mb-1">Company</label><input className={inputClass} placeholder="Acme Corp" value={newJob.company} onChange={e => setNewJob(p => ({ ...p, company: e.target.value }))} required /></div>
              <div><label className="block text-xs mb-1">Job Title</label><input className={inputClass} placeholder="Software Developer" value={newJob.title} onChange={e => setNewJob(p => ({ ...p, title: e.target.value }))} required /></div>
              <div><label className="block text-xs mb-1">URL (optional)</label><input className={inputClass} placeholder="https://..." value={newJob.url} onChange={e => setNewJob(p => ({ ...p, url: e.target.value }))} /></div>
              <div><label className="block text-xs mb-1">Notes (optional)</label><textarea className={`${inputClass} min-h-[60px]`} placeholder="Any notes..." value={newJob.notes} onChange={e => setNewJob(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button type="submit" className="w-full">Add to Saved</Button>
            </form>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <DroppableColumn key={col.id} id={col.id} label={col.label} color={col.color} count={(data[col.id] || []).length}>
              {(data[col.id] || []).map(job => (
                <DraggableCard key={job.id} job={job} columnId={col.id} onDelete={deleteJob} onMove={moveJob} />
              ))}
            </DroppableColumn>
          ))}
        </div>
        <DragOverlay>
          <CardOverlay job={activeJob} />
        </DragOverlay>
      </DndContext>

      {totalJobs === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Kanban className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No jobs tracked yet. Click "Add Job" to get started.</p>
        </div>
      )}
    </ToolLayout>
  );
}
