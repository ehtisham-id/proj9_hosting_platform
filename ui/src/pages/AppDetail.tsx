import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface AppDetail {
  id: number;
  name: string;
  status: string;
  instances: number;
  git_url?: string;
}

interface EnvVar {
  id: number;
  key: string;
  value: string;
}

interface Log {
  id: number;
  log_type: 'stdout' | 'stderr';
  message: string;
  timestamp: string;
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const appId = Number(id);
  const [logs, setLogs] = useState<Log[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  // Fetch app details
  const { data: app } = useQuery<AppDetail>(['app', appId], () =>
    axios.get(`/apps/${appId}`).then(res => res.data)
  );

  // Fetch env vars
  const { data: envVars } = useQuery(['envVars', appId], () =>
    axios.get(`/apps/${appId}/env`).then(res => res.data)
  );

  // Fetch logs
  const { data: recentLogs } = useQuery(['logs', appId], () =>
    axios.get(`/apps/${appId}/logs?limit=50`).then(res => res.data.logs), {
    refetchInterval: 3000 // Auto-refresh every 3s
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: (instances: number) => 
      axios.post(`/apps/${appId}/deploy`, { instances }),
    onSuccess: () => {
      queryClient.invalidateQueries(['app', appId]);
      toast.success('Deployed successfully!');
    }
  });

  // Scale mutation
  const scaleMutation = useMutation({
    mutationFn: ({ instances }: { instances: number }) => 
      axios.post(`/apps/${appId}/scale`, { instances }),
    onSuccess: () => {
      queryClient.invalidateQueries(['app', appId]);
      toast.success('Scaled successfully!');
    }
  });

  useEffect(() => {
    if (recentLogs && autoScroll) {
      setLogs(prev => [...prev.slice(-100), ...recentLogs].slice(-100));
    }
  }, [recentLogs, autoScroll]);

  if (!app) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-12">
        <button 
          onClick={() => window.history.back()} 
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Apps
        </button>
      </div>

      {/* App Header */}
      <div className="bg-gradient-to-r from-slate-800/70 to-slate-900/70 backdrop-blur-xl p-8 rounded-3xl mb-8 border border-slate-700">
        <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
              {app.name}
            </h1>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                app.status === 'running'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}
            >
              {app.status.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => deployMutation.mutate(1)}
              disabled={deployMutation.isLoading || app.status === 'running'}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-2xl font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deployMutation.isLoading ? 'Deploying...' : 'Deploy'}
            </button>
            <button
              onClick={() => scaleMutation.mutate({ instances: Math.max(1, app.instances - 1) })}
              disabled={scaleMutation.isLoading || app.instances <= 1}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-colors disabled:opacity-50"
            >
              Scale ↓ ({app.instances})
            </button>
            <button
              onClick={() => scaleMutation.mutate({ instances: app.instances + 1 })}
              disabled={scaleMutation.isLoading}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-colors disabled:opacity-50"
            >
              Scale ↑
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Environment Variables */}
        <div className="bg-slate-800/70 backdrop-blur-xl p-8 rounded-3xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Environment Variables
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {envVars?.map((env: EnvVar) => (
              <div key={env.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                <div>
                  <div className="font-mono text-sm font-bold text-white">{env.key}</div>
                  <div className="font-mono text-xs text-slate-400 truncate max-w-xs">{env.value}</div>
                </div>
                <button className="px-4 py-1 bg-red-600/80 hover:bg-red-700 text-xs rounded-lg transition-colors">
                  Delete
                </button>
              </div>
            ))}
            {envVars?.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No environment variables set
              </div>
            )}
          </div>
        </div>

        {/* Live Logs */}
        <div className="lg:col-span-2 bg-slate-900/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Live Logs
            </h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
              />
              Auto-scroll
            </label>
          </div>
          <div className="h-96 bg-black/50 rounded-2xl p-6 font-mono text-sm overflow-y-auto border border-slate-800">
            {logs.map((log, idx) => (
              <div key={idx} className={`mb-1 ${log.log_type === 'stderr' ? 'text-red-400' : 'text-green-400'}`}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-slate-500 text-center py-12">No logs yet. Deploy to see live output.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
