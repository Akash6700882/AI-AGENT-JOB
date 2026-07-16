import { useState } from 'react';
import { Play, Square, LogOut, LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface TopBarProps {
  agent: any;
  currentView?: string;
  onViewChange: (view: 'dashboard' | 'jobs' | 'applications' | 'resume') => void;
  onLoginClick?: () => void;
}

export function TopBar({ agent, currentView: _currentView, onViewChange, onLoginClick }: TopBarProps) {
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
    <div className="h-16 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-8 flex-shrink-0 z-10">
      {/* Left - Brand + Status */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight">
          Career<span className="text-gradient-green">Pilot</span>
        </h1>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-green" />
          <span className="text-xs font-mono-data text-primary uppercase tracking-wider">
            {agent?.searching ? 'Scanning...' : 'Agent Online'}
          </span>
        </div>
      </div>

      {/* Right - Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Stats Summary */}
        <div className="hidden md:flex items-center gap-4 mr-4">
          <div className="text-center">
            <div className="text-sm font-mono-data font-semibold text-primary">
              {agent?.jobs?.length || 0}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Matches</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-sm font-mono-data font-semibold text-primary">
              {agent.applications?.length || 0}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Applied</div>
          </div>
        </div>

        {/* Initiate Search Button */}
        <Button
          onClick={handleQuickSearch}
          disabled={isSearching || agent.searching}
          className={`rounded-full font-semibold ${
            isSearching || agent.searching
              ? 'bg-accent/20 text-accent border border-accent/30 hover:bg-accent/20 cursor-not-allowed'
              : 'glow-green hover:scale-105 active:scale-95'
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
        </Button>

        {/* Phase 0C: current user + logout; guests get a "save progress" CTA instead of their generated username */}
        <div className="flex items-center gap-2 pl-3 ml-1 border-l">
          {agent.isGuest ? (
            <Button
              variant="outline"
              onClick={onLoginClick}
              className="rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
            >
              <LogIn className="w-4 h-4" />
              Save Progress
            </Button>
          ) : agent.isAuthenticated ? (
            <>
              <span className="hidden md:inline text-xs text-muted-foreground">
                {agent.currentUser?.username}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={agent.logout}
                title="Log out"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={onLoginClick}
              className="rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}