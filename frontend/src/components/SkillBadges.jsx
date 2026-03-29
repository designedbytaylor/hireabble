import { BadgeCheck } from 'lucide-react';

export default function SkillBadges({ badges = [], size = 'sm' }) {
  if (!badges || badges.length === 0) return null;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px] gap-0.5'
    : 'px-2.5 py-1 text-xs gap-1';

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => {
        const name = typeof badge === 'string' ? badge : badge.skill_name;
        return (
          <span
            key={name}
            className={`inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/20 ${sizeClasses}`}
          >
            <BadgeCheck className={`${iconSize} shrink-0`} />
            {name}
          </span>
        );
      })}
    </div>
  );
}
