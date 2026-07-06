import { useState } from 'react';
import { Play, Square } from 'lucide-react';

interface TopBarProps {
  agent: any;
  currentView?: string;
  onViewChange: (view: 'dashboard' | 'jobs' | 'applications' | 'resume') => void;
}

export function TopBar({ agent, currentView: _currentView, onViewChange }: TopBarProps) {
  void _currentView;
  const [isSearching, setIsSearching] = useState(false);

  const handleQuickSearch = async () => {
    if (isSearching) return;
    setIsSearching(true);
    onViewChange('jobs');
    await agent.searchJobs({
      keywords: agent.resume?.skills?.slice(0, 3).join(' ') || 'software engineer',
      location: '',
      remote_only: true,
    });
    setIsSearching(false);
  };

  return (
    <div className="h-16 border-b border-[#1E3A8A]/50 bg-[#0A1128]/80 backdrop-blur-sm flex items-center justify-between px-8 flex-shrink-0 z-10">
      {/* Left - Brand + Status */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-[#F8FAFC] tracking-tight">
          Career<span className="text-gradient-green">Pilot</span>
        </h1>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30">
          <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse-green" />
          <span className="text-xs font-mono-data text-[#10B981] uppercase tracking-wider">
            {agent?.searching ? 'Scanning...' : 'Agent Online'}
          </span>
        </div>
      </div>

      {/* Right - Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Stats Summary */}
        <div className="hidden md:flex items-center gap-4 mr-4">
          <div className="text-center">
            <div className="text-sm font-mono-data font-semibold text-[#10B981]">
              {agent?.jobs?.length || 0}
            </div>
            <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Matches</div>
          </div>
          <div className="w-px h-8 bg-[#1E3A8A]" />
          <div className="text-center">
            <div className="text-sm font-mono-data font-semibold text-[#10B981]">
              {agent.applications?.length || 0}
            </div>
            <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Applied</div>
          </div>
        </div>

        {/* Initiate Search Button */}
        <button
          onClick={handleQuickSearch}
          disabled={isSearching || agent.searching}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300
            ${isSearching || agent.searching
              ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 cursor-not-allowed'
              : 'bg-[#10B981] text-[#030712] hover:bg-[#34D399] hover:scale-105 active:scale-95 glow-green'
            }`}
        >
          {isSearching || agent.searching ? (
            <>
              <Square className="w-4 h-4" />
              Scanning...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" fill="currentColor" />
              Initiate Search
            </>
          )}
        </button>
      </div>
    </div>
  );
}
