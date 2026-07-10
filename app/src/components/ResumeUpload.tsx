import { useCallback, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Sparkles, Mail, Phone, MapPin, Code } from 'lucide-react';

interface ResumeUploadProps {
  agent: any;
}

export function ResumeUpload({ agent }: ResumeUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Local state to force React to re-render when the agent's data changes
  const [resumeData, setResumeData] = useState(agent.resume);

  // Sync local state if agent.resume changes from outside (e.g., on initial load)
  useEffect(() => {
    setResumeData(agent.resume);
  }, [agent.resume]);

  const processUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadedFile(file);
      
      // Call the agent's upload method and wait for the backend response
      await agent.uploadResume(file);
      
      // Update local state with a new object reference to trigger UI refresh
      setResumeData({ ...agent.resume });
    } catch (error) {
      console.error("Resume upload failed:", error);
      alert("Failed to upload resume. Please check the backend connection.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt'))) {
        processUpload(file);
      }
    },
    [agent]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processUpload(file);
      }
    },
    [agent]
  );

  const resume = resumeData;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Upload Area */}
      <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden">
        <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-medium text-[#94A3B8]">Resume Upload</span>
        </div>
        <div className="p-6">
          {isUploading ? (
            <div className="p-12 text-center animate-pulse">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-[#10B981] animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">Analyzing Resume...</h3>
              <p className="text-sm text-[#94A3B8]">Extracting skills and experience with AI</p>
            </div>
          ) : !resume ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
                dragOver
                  ? 'border-[#10B981] bg-[#10B981]/5'
                  : 'border-[#1E3A8A]/50 hover:border-[#1E3A8A] bg-[#030712]/30'
              }`}
              onClick={() => document.getElementById('resume-input')?.click()}
            >
              <input
                id="resume-input"
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-[#10B981]" />
              </div>
              <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">Drop your resume here</h3>
              <p className="text-sm text-[#94A3B8] mb-4">or click to browse. Supports PDF, DOCX, and TXT files.</p>
              <div className="flex items-center justify-center gap-4 text-xs text-[#94A3B8]">
                <span className="px-3 py-1 rounded-full bg-[#030712] border border-[#1E3A8A]/30">PDF</span>
                <span className="px-3 py-1 rounded-full bg-[#030712] border border-[#1E3A8A]/30">DOCX</span>
                <span className="px-3 py-1 rounded-full bg-[#030712] border border-[#1E3A8A]/30">TXT</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-[#030712] rounded-xl border border-[#10B981]/30">
              <div className="w-12 h-12 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#10B981]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[#F8FAFC]">
                  {uploadedFile?.name || 'Resume loaded'}
                </div>
                <div className="text-xs text-[#94A3B8]">
                  {resume.skills?.length || 0} skills extracted
                </div>
              </div>
              <button
                onClick={() => {
                  setResumeData(null);
                  setUploadedFile(null);
                }}
                className="px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
              >
                Replace
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resume Details Grid */}
      {resume && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
          {/* Profile Overview */}
          <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden">
            <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium text-[#94A3B8]">Profile Overview</span>
            </div>
            <div className="p-4 space-y-3">
              {resume.name && <div className="text-lg font-semibold text-[#F8FAFC]">{resume.name}</div>}
              <div className="space-y-2">
                {resume.email && (
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <Mail className="w-4 h-4 text-[#10B981]" />
                    {resume.email}
                  </div>
                )}
                {resume.phone && (
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <Phone className="w-4 h-4 text-[#10B981]" />
                    {resume.phone}
                  </div>
                )}
                {resume.location && (
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <MapPin className="w-4 h-4 text-[#10B981]" />
                    {resume.location}
                  </div>
                )}
              </div>
              {resume.summary && (
                <div className="mt-4 pt-4 border-t border-[#1E3A8A]/30">
                  <p className="text-sm text-[#94A3B8] leading-relaxed line-clamp-4">{resume.summary}</p>
                </div>
              )}
            </div>
          </div>

          {/* Skills Section */}
          <div className="rounded-xl border border-[#1E3A8A]/50 bg-[#0A1128] card-gradient overflow-hidden">
            <div className="p-4 border-b border-[#1E3A8A]/30 flex items-center gap-2">
              <Code className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium text-[#94A3B8]">
                Skills ({resume.skills?.length || 0})
              </span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {resume.skills?.map((skill: string, idx: number) => (
                  <span
                    key={`${skill}-${idx}`}
                    className="px-3 py-1.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-lg text-sm"
                  >
                    {skill}
                  </span>
                )) || <p className="text-sm text-[#94A3B8]">No skills detected</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}