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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { JobResult } from '@/services/api';
import { Loader2 } from 'lucide-react';

type View = 'dashboard' | 'jobs' | 'applications' | 'resume' | 'tools';

export default function Home() {
  const agent = useAgentContext();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [, setSelectedJob] = useState<JobResult | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
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
            <LoadingView />
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

      {/* Login / Register modal — opt-in, so a guest can upgrade to a real account */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-sm border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Sign in or create a CareerPilot account</DialogTitle>
          <DialogDescription className="sr-only">
            Sign in, create an account, or reset your password to use CareerPilot.
          </DialogDescription>
          <LoginForm agent={agent} onClose={() => setShowAuthModal(false)} />
        </DialogContent>
      </Dialog>

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

function LoadingView() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center animate-fade-in-up">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Starting your session…</p>
    </div>
  );
}
