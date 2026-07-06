import {
  LayoutDashboard,
  Search,
  ClipboardList,
  FileText,
  Bot,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: 'dashboard' | 'jobs' | 'applications' | 'resume') => void;
  agent: any;
}

const navItems = [
  { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'jobs' as const, icon: Search, label: 'Find Jobs' },
  { id: 'applications' as const, icon: ClipboardList, label: 'Applications' },
  { id: 'resume' as const, icon: FileText, label: 'Resume' },
];

export function Sidebar({ currentView, onViewChange, agent }: SidebarProps) {
  return (
    <div className="w-16 flex-shrink-0 bg-[#0A1128]/80 border-r border-[#1E3A8A]/50 flex flex-col items-center py-6 gap-2 z-20">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center glow-green">
          <Bot className="w-6 h-6 text-[#030712]" />
        </div>
      </div>

      {/* Nav Items */}
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group
              ${isActive
                ? 'bg-[#10B981]/15 text-[#10B981]'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E3A8A]/30'
              }`}
            title={item.label}
          >
            <Icon className="w-5 h-5" />
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#10B981] rounded-r-full" />
            )}

            {/* Tooltip */}
            <div className="absolute left-14 bg-[#0A1128] border border-[#1E3A8A] px-3 py-1.5 rounded-lg text-sm text-[#F8FAFC] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              {item.label}
            </div>
          </button>
        );
      })}

      {/* Agent Status Indicator */}
      <div className="mt-auto">
        <div className={`w-3 h-3 rounded-full ${
          agent.searching
            ? 'bg-[#F59E0B] animate-pulse'
            : agent.resume
            ? 'bg-[#10B981]'
            : 'bg-[#94A3B8]'
        }`} />
      </div>
    </div>
  );
}
