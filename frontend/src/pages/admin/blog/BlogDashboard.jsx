import {
  FileText, CheckCircle, XCircle, Clock, Square, Loader2,
} from 'lucide-react';
import { PAGE_TYPE_MAP } from './blogConstants';

function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-yellow-500/20 text-yellow-400',
    published: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    running: 'bg-indigo-500/20 text-indigo-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
    completed_with_errors: 'bg-yellow-500/20 text-yellow-400',
    pending: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-700 text-gray-400'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

export { StatusBadge };

export default function BlogDashboard({ stats, jobs, cancelJob }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', value: stats.total, icon: FileText, color: 'text-indigo-400' },
          { label: 'Published', value: stats.published, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Drafts', value: stats.draft, icon: Clock, color: 'text-yellow-400' },
          { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="text-sm text-gray-400">{label}</span>
            </div>
            <div className="text-3xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Generation Jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-gray-500 text-sm">No generation jobs yet.</p>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => {
              const pct = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0;
              return (
                <div key={job.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">
                        {PAGE_TYPE_MAP[job.page_type] || job.page_type}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    {job.status === 'running' && (
                      <button
                        onClick={() => cancelJob(job.id)}
                        className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <Square className="w-3 h-3" /> Cancel
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                    <span>{job.completed}/{job.total} completed</span>
                    {job.failed > 0 && <span className="text-red-400">{job.failed} failed</span>}
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${job.status === 'running' ? 'bg-indigo-500' : job.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
