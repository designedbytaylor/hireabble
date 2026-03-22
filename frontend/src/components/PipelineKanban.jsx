import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Briefcase, MapPin, Rocket, MessageSquare, Calendar,
  Eye, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getPhotoUrl } from '../utils/helpers';

const KANBAN_STAGES = [
  { key: 'applied', label: 'Applied', color: 'border-blue-500/40', headerBg: 'bg-blue-500/10', headerText: 'text-blue-400', dotColor: 'bg-blue-500' },
  { key: 'shortlisted', label: 'Shortlisted', color: 'border-purple-500/40', headerBg: 'bg-purple-500/10', headerText: 'text-purple-400', dotColor: 'bg-purple-500' },
  { key: 'interviewing', label: 'Interview', color: 'border-cyan-500/40', headerBg: 'bg-cyan-500/10', headerText: 'text-cyan-400', dotColor: 'bg-cyan-500' },
  { key: 'hired', label: 'Hired', color: 'border-emerald-500/40', headerBg: 'bg-emerald-500/10', headerText: 'text-emerald-400', dotColor: 'bg-emerald-500' },
];

const REJECTED_STAGE = { key: 'declined', label: 'Rejected', color: 'border-red-500/40', headerBg: 'bg-red-500/10', headerText: 'text-red-400', dotColor: 'bg-red-500' };

// Draggable candidate card
function DraggableCard({ app, onViewProfile, onMessage, onReject, getStage, showJobTitle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id, data: { stage: getStage(app) } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="glass-card rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-primary/20 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <img
          src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
          alt={app.seeker_name}
          className="w-10 h-10 rounded-full border border-border object-cover flex-shrink-0"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">{app.seeker_name}</span>
            {app.action === 'superlike' && (
              <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold flex-shrink-0">
                Priority
              </span>
            )}
          </div>
          <div className="text-xs text-primary truncate">{app.seeker_title || 'Candidate'}</div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
            {app.seeker_experience && <span>{app.seeker_experience}+ yrs</span>}
            {app.seeker_location && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="w-2.5 h-2.5" /> {app.seeker_location}
              </span>
            )}
          </div>
          {showJobTitle && app.job_title && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 truncate">
              <Briefcase className="w-2.5 h-2.5 flex-shrink-0" /> {app.job_title}
            </div>
          )}
          {app.seeker_skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {app.seeker_skills.slice(0, 3).map((skill, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded-full bg-accent text-[10px] text-muted-foreground">
                  {skill}
                </span>
              ))}
              {app.seeker_skills.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{app.seeker_skills.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions - visible on hover */}
      <div className="flex gap-1 mt-2 pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onViewProfile(app); }}
          className="flex-1 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-1"
        >
          <Eye className="w-3 h-3" /> Profile
        </button>
        {app.match_id && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onMessage(app); }}
            className="flex-1 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
          >
            <MessageSquare className="w-3 h-3" /> Message
          </button>
        )}
        {getStage(app) !== 'declined' && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onReject(app); }}
            className="flex-1 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" /> Reject
          </button>
        )}
      </div>
    </div>
  );
}

// Static card for the drag overlay
function CardOverlay({ app, showJobTitle }) {
  return (
    <div className="glass-card rounded-xl p-3 border-primary/40 shadow-lg shadow-primary/10 w-[260px]">
      <div className="flex items-start gap-3">
        <img
          src={getPhotoUrl(app.seeker_photo || app.seeker_avatar, app.seeker_name || app.seeker_id)}
          alt={app.seeker_name}
          className="w-10 h-10 rounded-full border border-border object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">{app.seeker_name}</span>
            {app.action === 'superlike' && (
              <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold flex-shrink-0">
                Priority
              </span>
            )}
          </div>
          <div className="text-xs text-primary truncate">{app.seeker_title || 'Candidate'}</div>
          {showJobTitle && app.job_title && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 truncate">
              <Briefcase className="w-2.5 h-2.5 flex-shrink-0" /> {app.job_title}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Kanban column - acts as droppable container
function KanbanColumn({ stage, apps, getStage, onViewProfile, onMessage, onReject, showJobTitle }) {
  const appIds = apps.map(a => a.id);

  return (
    <div className={`flex flex-col min-w-[280px] max-w-[300px] rounded-2xl border ${stage.color} bg-card/50 flex-shrink-0`}>
      {/* Column header */}
      <div className={`px-4 py-3 rounded-t-2xl ${stage.headerBg} flex items-center gap-2`}>
        <div className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
        <h3 className={`font-medium text-sm ${stage.headerText}`}>{stage.label}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{apps.length}</span>
      </div>

      {/* Cards container */}
      <SortableContext items={appIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[100px]">
          {apps.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No candidates
            </div>
          ) : (
            apps.map(app => (
              <DraggableCard
                key={app.id}
                app={app}
                getStage={getStage}
                onViewProfile={onViewProfile}
                onMessage={onMessage}
                onReject={onReject}
                showJobTitle={showJobTitle}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelineKanban({
  applications,
  getStage,
  updateStage,
  onViewProfile,
  onMessage,
  showJobTitle,
}) {
  const [showRejected, setShowRejected] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Group apps by stage
  const columns = {};
  for (const stage of [...KANBAN_STAGES, REJECTED_STAGE]) {
    columns[stage.key] = [];
  }
  for (const app of applications) {
    const stage = getStage(app);
    if (columns[stage]) {
      columns[stage].push(app);
    } else {
      columns.applied.push(app);
    }
  }

  const activeApp = activeId ? applications.find(a => a.id === activeId) : null;

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeAppItem = applications.find(a => a.id === active.id);
    if (!activeAppItem) return;

    // Determine the target stage
    let targetStage = null;

    // Check if dropped over a card — get that card's stage
    const overApp = applications.find(a => a.id === over.id);
    if (overApp) {
      targetStage = getStage(overApp);
    }

    // If dropped over a column container (the SortableContext id matches a stage key)
    if (!targetStage && KANBAN_STAGES.concat(REJECTED_STAGE).some(s => s.key === over.id)) {
      targetStage = over.id;
    }

    if (!targetStage) return;

    const currentStage = getStage(activeAppItem);
    if (currentStage === targetStage) return;

    updateStage(active.id, targetStage);
  };

  const handleDragOver = (event) => {
    // Allow items to be dragged between columns
  };

  const handleReject = (app) => {
    updateStage(app.id, 'declined');
  };

  const visibleStages = showRejected ? [...KANBAN_STAGES, REJECTED_STAGE] : KANBAN_STAGES;
  const rejectedCount = columns.declined?.length || 0;

  return (
    <div className="relative z-10">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 px-6 md:px-8">
          {visibleStages.map(stage => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              apps={columns[stage.key] || []}
              getStage={getStage}
              onViewProfile={onViewProfile}
              onMessage={onMessage}
              onReject={handleReject}
              showJobTitle={showJobTitle}
            />
          ))}
        </div>

        <DragOverlay>
          {activeApp ? <CardOverlay app={activeApp} showJobTitle={showJobTitle} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Show/Hide Rejected toggle */}
      <div className="px-6 md:px-8 mt-2">
        <button
          onClick={() => setShowRejected(!showRejected)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showRejected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showRejected ? 'Hide' : 'Show'} Rejected ({rejectedCount})
        </button>
      </div>
    </div>
  );
}
