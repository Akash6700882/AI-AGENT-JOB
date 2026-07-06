import { useState } from 'react';
import { Search, MapPin, Briefcase, Globe, Filter } from 'lucide-react';

interface SearchPanelProps {
  agent: any;
  onSearch: (config: {
    keywords: string;
    location?: string;
    job_type?: string;
    remote_only?: boolean;
  }) => Promise<any[]>;
}

export function SearchPanel({ agent, onSearch }: SearchPanelProps) {
  const [keywords, setKeywords] = useState(agent.resume?.skills?.slice(0, 3).join(' ') || 'Software Engineer');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(true);

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    await onSearch({
      keywords,
      location,
      job_type: jobType,
      remote_only: remoteOnly,
    });
  };

  return (
    <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden">
      <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center gap-2">
        <Filter className="w-4 h-4 text-[#10B981]" />
        <span className="text-sm font-medium text-[#94A3B8]">Search Parameters</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Keywords */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Job title, keywords..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/20 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="w-full pl-10 pr-4 py-2.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-sm text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/20 transition-all"
            />
          </div>

          {/* Job Type */}
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#030712] border border-[#1E3A8A]/50 rounded-lg text-sm text-[#F8FAFC] focus:outline-none focus:border-[#10B981]/50 focus:ring-1 focus:ring-[#10B981]/20 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="full-time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="part-time">Part-time</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#94A3B8] cursor-pointer select-none">
              <div
                className={`w-9 h-5 rounded-full transition-all duration-300 ${remoteOnly ? 'bg-[#10B981]' : 'bg-[#1E3A8A]/50'}`}
                onClick={() => setRemoteOnly(!remoteOnly)}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 mt-0.5 ${remoteOnly ? 'translate-x-4.5 ml-4' : 'translate-x-0.5'}`}
                />
              </div>
              <Globe className="w-3.5 h-3.5" />
              Remote
            </label>

            <button
              onClick={handleSearch}
              disabled={agent.searching}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10B981] text-[#030712] rounded-lg font-semibold text-sm hover:bg-[#34D399] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {agent.searching ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#030712] border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

