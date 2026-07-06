import { useEffect, useRef, useState } from 'react';
import { Activity, Globe, Cpu, TrendingUp, Zap } from 'lucide-react';

interface AgentStatusHUDProps {
  agent: any;
}

export function AgentStatusHUD({ agent }: AgentStatusHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ✅ SAFE AGENT (prevents all undefined crashes)
  const safeAgent = {
    jobs: [],
    applications: [],
    searching: false,
    ...agent,
  };

  const [logs, setLogs] = useState<string[]>([
    '[09:41:23] Agent initialized',
    '[09:41:24] Resume loaded - 24 skills extracted',
    '[09:41:25] Ready for job search',
  ]);

  // 🎯 Orbit animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };

    resize();
    window.addEventListener('resize', resize);

    const particles: any[] = [];

    for (let i = 0; i < 40; i++) {
      particles.push({
        angle: (Math.PI * 2 * i) / 40,
        radius: 40 + Math.random() * 60,
        speed: 0.002 + Math.random() * 0.004,
        size: 1.5 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.7,
        color: Math.random() > 0.7 ? '#10B981' : '#06B6D4',
      });
    }

    let animationId: number;

    const animate = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // rings
      [60, 80, 100].forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(16,185,129,${0.05 + i * 0.03})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // particles
      particles.forEach((p) => {
        p.angle += p.speed;

        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius;

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 🧠 Logs update safely
  useEffect(() => {
    if (safeAgent.searching) {
      const time = new Date().toLocaleTimeString();

      const newLogs = [
        `[${time}] Starting job scan...`,
        `[${time}] Querying job boards...`,
        `[${time}] Parsing descriptions...`,
        `[${time}] Matching profile...`,
      ];

      setLogs((prev) => [...prev.slice(-10), ...newLogs]);
    }
  }, [safeAgent.searching]);

  // ✅ SAFE DATA
  const jobs = safeAgent.jobs;

  const metrics = [
    {
      icon: Globe,
      label: 'Jobs Scanned',
      value: jobs.length + 1247, // fixed
      color: '#10B981',
    },
    {
      icon: TrendingUp,
      label: 'Match Score Avg',
      value:
        jobs.length > 0
          ? Math.round(
              jobs.reduce((a: number, j: any) => a + (j.match_score || 0), 0) /
                jobs.length
            )
          : 72,
      color: '#10B981',
    },
    {
      icon: Cpu,
      label: 'API Calls',
      value: safeAgent.searching ? '...' : '1.2K',
      color: '#06B6D4',
    },
    {
      icon: Zap,
      label: 'Success Rate',
      value: '94%',
      color: '#F59E0B',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* LEFT PANEL */}
      <div className="lg:col-span-1 rounded-xl border bg-[#0A1128]">
        <div className="p-4 border-b flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-400">Agent Core</span>
        </div>

        <div className="relative h-64">
          <canvas ref={canvasRef} className="w-full h-full" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-400 flex items-center justify-center mb-2">
                <Zap className="text-green-400" />
              </div>
              <div className="text-xs text-green-400">ACTIVE</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="lg:col-span-2 rounded-xl border bg-[#0A1128]">
        <div className="p-4 border-b flex justify-between">
          <span className="text-sm text-gray-400">Live Metrics</span>

          <span className="text-xs text-gray-400">
            {safeAgent.searching ? 'Scanning' : 'Live'}
          </span>
        </div>

        {/* METRICS */}
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="text-center p-3 border rounded">
                <Icon className="mx-auto mb-2" />
                <div className="text-white font-bold">{m.value}</div>
                <div className="text-xs text-gray-400">{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* LOGS */}
        <div className="p-4">
          <div className="bg-black p-3 h-28 overflow-y-auto text-xs">
            {logs.slice(-8).map((log, i) => (
              <div key={i}>▶ {log}</div>
            ))}

            {safeAgent.searching && <div>▶ Processing...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}