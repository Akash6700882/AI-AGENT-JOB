import { useState } from 'react';
import { ClipboardList, CheckCircle, Clock, XCircle, Star, ChevronDown, ExternalLink, Trash2 } from 'lucide-react';

interface ApplicationsPanelProps {
  agent: any;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: '#F59E0B', icon: Clock, label: 'Pending' },
  applied: { color: '#06B6D4', icon: CheckCircle, label: 'Applied' },
  rejected: { color: '#EF4444', icon: XCircle, label: 'Rejected' },
  interview: { color: '#10B981', icon: Star, label: 'Interview' },
  offer: { color: '#10B981', icon: Star, label: 'Offer' },
  accepted: { color: '#10B981', icon: CheckCircle, label: 'Accepted' },
  declined: { color: '#94A3B8', icon: XCircle, label: 'Declined' },
};

export function ApplicationsPanel({ agent }: ApplicationsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  const filteredApps = statusFilter === 'all'
    ? agent.applications
    : agent.applications.filter((a: any) => a.status === statusFilter);

  const stats = agent.statistics?.applications || {};

  const statusCounts = [
    { key: 'all', label: 'All', count: stats.total || 0 },
    { key: 'pending', label: 'Pending', count: stats.pending || 0 },
    { key: 'applied', label: 'Applied', count: stats.applied || 0 },
    { key: 'interview', label: 'Interview', count: stats.interview || 0 },
    { key: 'rejected', label: 'Rejected', count: stats.rejected || 0 },
    { key: 'offer', label: 'Offer', count: stats.offer || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total || 0, color: '#F8FAFC' },
          { label: 'Applied', value: stats.applied || 0, color: '#06B6D4' },
          { label: 'Interview Rate', value: `${stats.interview_rate || 0}%`, color: '#10B981' },
          { label: 'Response Rate', value: `${stats.response_rate || 0}%`, color: '#F59E0B' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient p-4 text-center">
            <div className="text-2xl font-mono-data font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-1">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Applications List */}
      <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden">
        <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#10B981]" />
            <span className="text-sm font-medium text-[#94A3B8]">
              Applications <span className="text-[#10B981] font-mono-data">({filteredApps.length})</span>
            </span>
          </div>
        </div>

        {/* Status Filters */}
        <div className="px-4 py-3 border-b border-[#1E3A8A]/20 flex flex-wrap gap-2">
          {statusCounts.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s.key
                  ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
              }`}
            >
              {s.label} ({s.count})
            </button>
          ))}
        </div>

        {/* Applications */}
        {filteredApps.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-[#1E3A8A] mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">
              {statusFilter === 'all'
                ? 'No applications yet. Search for jobs and start applying!'
                : `No applications with status "${statusFilter}"`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E3A8A]/20">
            {filteredApps.map((app: any) => {
              const config = statusConfig[app.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              const isExpanded = expandedApp === app.id;

              return (
                <div
                  key={app.id}
                  className="group hover:bg-[#1E3A8A]/10 transition-all duration-200"
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${config.color}15` }}
                      >
                        <StatusIcon className="w-5 h-5" style={{ color: config.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#F8FAFC]">
                          {app.job_title}
                        </div>
                        <div className="text-xs text-[#94A3B8]">
                          {app.company} • {app.location}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            color: config.color,
                            backgroundColor: `${config.color}15`,
                          }}
                        >
                          {config.label}
                        </span>
                        <div className="text-[10px] text-[#94A3B8] mt-1">
                          {app.applied_date ? new Date(app.applied_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-[#94A3B8] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in-up">
                      <div className="bg-[#030712] rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                          <span>Match Score: <span className="text-[#10B981] font-mono-data font-semibold">{Math.round(app.match_score)}%</span></span>
                          {app.salary && <span>Salary: {app.salary}</span>}
                          <span>Source: {app.source}</span>
                        </div>

                        {app.notes && (
                          <div className="text-xs text-[#94A3B8]">
                            <span className="text-[#F59E0B]">Notes:</span> {app.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A]/20 border border-[#1E3A8A]/50 text-[#06B6D4] rounded-lg text-xs hover:bg-[#1E3A8A]/30 transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Job
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              agent.deleteApplication(app.id);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg text-xs hover:bg-[#EF4444]/20 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
