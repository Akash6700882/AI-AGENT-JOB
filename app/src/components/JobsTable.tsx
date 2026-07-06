import { useState } from 'react';
import { ExternalLink, MapPin, DollarSign, Calendar, Cpu, CheckCircle, Sparkles } from 'lucide-react';
import type { JobResult } from '@/services/api';

interface JobsTableProps {
  jobs: JobResult[];
  onApply: (jobId: string) => Promise<any>;
  onSelect?: (job: JobResult | null) => void;
  loading: boolean;
}

export function JobsTable({ jobs, onApply, onSelect: _onSelect, loading }: JobsTableProps) {
  void _onSelect;
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortBy === 'score') return b.match_score - a.match_score;
    return 0;
  });

  const handleApply = async (jobId: string) => {
    setApplyingId(jobId);
    await onApply(jobId);
    setApplyingId(null);
  };

  const toggleExpand = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#94A3B8] text-sm">Scanning job boards...</p>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient p-12">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="w-12 h-12 text-[#1E3A8A]" />
          <p className="text-[#94A3B8] text-sm">Configure your search and click "Search" to find matching jobs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden">
      <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-medium text-[#94A3B8]">
            Matched Jobs <span className="text-[#10B981] font-mono-data">({jobs.length})</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94A3B8]">Sort:</span>
          <button
            onClick={() => setSortBy('score')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'score'
                ? 'bg-[#10B981]/20 text-[#10B981]'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Match Score
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-[#94A3B8] uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Match</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Location</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Salary</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E3A8A]/20">
            {sortedJobs.map((job, index) => {
              const isExpanded = expandedJob === job.id;
              const isApplying = applyingId === job.id;
              const scoreColor = job.match_score >= 80 ? '#10B981' : job.match_score >= 60 ? '#F59E0B' : '#94A3B8';

              return (
                <>
                  <tr
                    key={job.id}
                    className="group hover:bg-[#1E3A8A]/10 transition-all duration-200 cursor-pointer animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => toggleExpand(job.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#1E3A8A]/20 flex items-center justify-center text-xs font-bold text-[#10B981]">
                          {job.company.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#F8FAFC] group-hover:text-[#10B981] transition-colors">
                            {job.title}
                          </div>
                          <div className="text-xs text-[#94A3B8]">{job.source}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#94A3B8]">{job.company}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-[#030712] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${job.match_score}%`,
                              backgroundColor: scoreColor,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono-data font-semibold" style={{ color: scoreColor }}>
                          {Math.round(job.match_score)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                        {job.remote && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] text-[10px]">
                            Remote
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {job.salary ? (
                        <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
                          <DollarSign className="w-3 h-3" />
                          {job.salary}
                        </div>
                      ) : (
                        <span className="text-xs text-[#94A3B8]/50">Not disclosed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(job.id);
                        }}
                        disabled={isApplying}
                        className="px-3 py-1.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-lg text-xs font-medium hover:bg-[#10B981] hover:text-[#030712] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isApplying ? (
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        Apply
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${job.id}-detail`}>
                      <td colSpan={6} className="px-4 py-4 bg-[#030712]/50 animate-fade-in-up">
                        <div className="space-y-3">
                          <p className="text-sm text-[#94A3B8] leading-relaxed">
                            {job.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {job.matched_skills.map((skill: string) => (
                              <span key={skill} className="px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-md text-xs">
                                {skill}
                              </span>
                            ))}
                            {job.missing_skills.map((skill: string) => (
                              <span key={skill} className="px-2 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] rounded-md text-xs">
                                {skill} (missing)
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {job.posted_date}
                            </span>
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#06B6D4] hover:text-[#10B981] transition-colors flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Job Posting
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
