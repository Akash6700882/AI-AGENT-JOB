import {
  LayoutDashboard,
  Search,
  ClipboardList,
  FileText,
  Sparkles,
  Bot,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: 'dashboard' | 'jobs' | 'applications' | 'resume' | 'tools') => void;
  agent: any;
}

const navItems = [
  { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'jobs' as const, icon: Search, label: 'Find Jobs' },
  { id: 'applications' as const, icon: ClipboardList, label: 'Applications' },
  { id: 'resume' as const, icon: FileText, label: 'Resume' },
  { id: 'tools' as const, icon: Sparkles, label: 'AI Tools' },
];

export function Sidebar({ currentView, onViewChange, agent }: SidebarProps) {
  return (
    <div className="w-16 flex-shrink-0 bg-card/80 border-r flex flex-col items-center py-6 gap-2 z-20">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center glow-green">
          <Bot className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>

      {/* Nav Items */}
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        const Icon = item.icon;
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onViewChange(item.id)}
                className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                  ${isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
              >
                <Icon className="w-5 h-5" />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}

      {/* Agent Status Indicator */}
      <div className="mt-auto">
        <div className={`w-3 h-3 rounded-full ${
          agent.searching
            ? 'bg-accent animate-pulse'
            : agent.resume
            ? 'bg-primary'
            : 'bg-muted-foreground'
        }`} />
      </div>
    </div>
  );
}
