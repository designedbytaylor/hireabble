import { Skeleton } from './ui/skeleton';

// ─── Background blur effect (shared by all pages) ────────────────────────
export function SkeletonPageBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
    </div>
  );
}

// ─── Stat card skeleton ──────────────────────────────────────────────────
export function SkeletonStatCard({ variant = 'horizontal' }) {
  if (variant === 'bento') {
    return (
      <div className="glass-card rounded-2xl p-5">
        <Skeleton className="w-12 h-12 rounded-xl mb-3" />
        <Skeleton className="h-8 w-16 rounded mb-1" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
    );
  }
  return (
    <div className="glass-card rounded-2xl px-5 py-3 flex items-center gap-3 whitespace-nowrap">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div>
        <Skeleton className="h-6 w-10 rounded mb-1" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
    </div>
  );
}

// ─── List item skeleton ──────────────────────────────────────────────────
export function SkeletonListItem({
  avatarSize = 'w-14 h-14',
  avatarShape = 'rounded-xl',
  lines = 3,
  actions = false,
  badge = false,
}) {
  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
      <Skeleton className={`${avatarSize} ${avatarShape} shrink-0`} />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-5 w-3/4 rounded" />
        {lines >= 2 && <Skeleton className="h-3.5 w-1/2 rounded" />}
        {lines >= 3 && <Skeleton className="h-3 w-2/3 rounded" />}
      </div>
      {badge && <Skeleton className="w-16 h-5 rounded-full shrink-0" />}
      {actions && (
        <div className="flex gap-2 shrink-0">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <Skeleton className="w-11 h-11 rounded-xl" />
        </div>
      )}
    </div>
  );
}

// ─── Swipe card skeleton ─────────────────────────────────────────────────
export function SkeletonSwipeCard() {
  return (
    <div className="relative aspect-[3/4] rounded-3xl overflow-hidden glass-card">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-2.5 w-16 rounded" />
          </div>
        </div>
        <Skeleton className="h-7 w-3/4 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Action buttons skeleton (swipe pages) ───────────────────────────────
export function SkeletonActionButtons() {
  return (
    <div className="flex justify-center items-center gap-5 mt-8">
      <Skeleton className="w-12 h-12 rounded-full" />
      <Skeleton className="w-16 h-16 rounded-full" />
      <Skeleton className="w-20 h-20 rounded-full" />
      <Skeleton className="w-16 h-16 rounded-full" />
    </div>
  );
}

// ─── Filter tabs skeleton ────────────────────────────────────────────────
export function SkeletonFilterTabs({ count = 4 }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
      ))}
    </div>
  );
}

// ─── Horizontal scroll applicant cards skeleton (RecruiterDashboard) ─────
export function SkeletonApplicantCard() {
  return (
    <div className="glass-card rounded-2xl p-4 min-w-[220px] flex-shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-14 h-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-32 rounded mb-2" />
      <Skeleton className="h-3 w-24 rounded mb-1" />
      <Skeleton className="h-3 w-20 rounded mb-3" />
      <div className="flex gap-2">
        <Skeleton className="flex-1 h-9 rounded-lg" />
        <Skeleton className="flex-1 h-9 rounded-lg" />
      </div>
    </div>
  );
}
