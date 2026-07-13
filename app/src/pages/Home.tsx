import { useState } from 'react';
import { useAgentContext } from '@/components/AgentContext';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { AgentStatusHUD } from '@/components/AgentStatusHUD';
import { AnalyticsGrid } from '@/components/AnalyticsGrid';
import { JobsTable } from '@/components/JobsTable';
import { ApplicationsPanel } from '@/components/ApplicationsPanel';
import { ResumeUpload } from '@/components/ResumeUpload';
import { SearchPanel } from '@/components/SearchPanel';
import { ToolsPanel } from '@/components/ToolsPanel';
import { Toast } from '@/components/Toast';
import { LoginForm } from '@/components/LoginForm';
import type { JobResult } from '@/services/api';
import { Bot, LogIn } from 'lucide-react';

type View = 'dashboard' | 'jobs' | 'applications' | 'resume' | 'tools';

export default function Home() {
  const agent = useAgentContext();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [, setSelectedJob] = useState<JobResult | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#030712] overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentView={currentView} onViewChange={setCurrentView} agent={agent} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar
          agent={agent}
          currentView={currentView}
          onViewChange={setCurrentView}
          onLoginClick={() => setShowAuthModal(true)}
        />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 scanline">
          {!agent.isAuthenticated ? (
            <LandingView onLoginClick={() => setShowAuthModal(true)} />
          ) : (
            <>
              {currentView === 'dashboard' && (
                <div className="space-y-6 animate-fade-in-up">
                  <AgentStatusHUD agent={agent} />
                  <AnalyticsGrid agent={agent} />
                </div>
              )}

              {currentView === 'jobs' && (
                <div className="space-y-6 animate-fade-in-up">
                  <SearchPanel agent={agent} onSearch={agent.searchJobs} />
                  <JobsTable
                    jobs={agent.jobs}
                    onApply={agent.applyToJob}
                    onSelect={setSelectedJob}
                    loading={agent.searching}
                  />
                </div>
              )}

              {currentView === 'applications' && (
                <div className="animate-fade-in-up">
                  <ApplicationsPanel agent={agent} />
                </div>
              )}

              {currentView === 'resume' && (
                <div className="animate-fade-in-up">
                  <ResumeUpload agent={agent} />
                </div>
              )}

              {currentView === 'tools' && (
                <div className="animate-fade-in-up">
                  <ToolsPanel agent={agent} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Login / Register modal */}
      {showAuthModal && !agent.isAuthenticated && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <LoginForm agent={agent} onClose={() => setShowAuthModal(false)} />
        </div>
      )}

      {/* Toast Notification */}
      {agent.toast && (
        <Toast
          message={agent.toast.message}
          type={agent.toast.type}
          onClose={() => {}}
        />
      )}
    </div>
  );
}

function LandingView({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center animate-fade-in-up">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] glow-green">
        <Bot className="h-9 w-9 text-[#030712]" />
      </div>
      <h1 className="text-3xl font-bold text-[#F8FAFC] tracking-tight">
        Welcome to Career<span className="text-gradient-green">Pilot</span>
      </h1>
      <p className="mt-3 max-w-md text-sm text-[#94A3B8]">
        Upload your resume, let the agent scan real job boards, and track every
        application in one place. Sign in or create a free account to get started.
      </p>
      <button
        onClick={onLoginClick}
        className="mt-8 flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-[#10B981] text-[#030712] hover:bg-[#34D399] hover:scale-105 active:scale-95 transition-all duration-300 glow-green"
      >
        <LogIn className="w-4 h-4" />
        Login / Create Account
      </button>
    </div>
  );
}
