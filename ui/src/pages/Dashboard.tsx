import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface App {
  id: number;
  name: string;
  status: string;
  instances: number;
  last_deployed?: string;
}

export default function Dashboard() {
  const { logout } = useAuth();
  const [newAppName, setNewAppName] = useState('');

  const { data: apps, refetch } = useQuery<App[]>('apps', () =>
    axios.get('/apps').then(res => res.data)
  );

  const createApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/apps', { name: newAppName });
      setNewAppName('');
      refetch();
      toast.success('App created!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create app');
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          My Apps
        </h1>
        <div className="flex gap-4">
          <button
            onClick={logout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <form onSubmit={createApp} className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl mb-12">
        <div className="flex gap-4 max-w-md">
          <input
            value={newAppName}
            onChange={(e) => setNewAppName(e.target.value)}
            placeholder="App name"
            className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
          >
            Create App
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {apps?.map((app) => (
          <Link
            key={app.id}
            to={`/app/${app.id}`}
            className="group"
          >
            <div className="bg-slate-800/70 backdrop-blur-xl p-8 rounded-2xl border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/90 transition-all group-hover:-translate-y-2 hover:shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white truncate">{app.name}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    app.status === 'running'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  }`}
                >
                  {app.status}
                </span>
              </div>
              <div className="space-y-3 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Instances</span>
                  <span className="font-mono">{app.instances}</span>
                </div>
                {app.last_deployed && (
                  <div className="flex justify-between text-xs">
                    <span>Last Deploy</span>
                    <span className="font-mono">
                      {new Date(app.last_deployed).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {apps?.length === 0 && (
        <div className="text-center py-24">
          <div className="w-24 h-24 bg-slate-700/50 rounded-2xl mx-auto mb-8 flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">No apps yet</h2>
          <p className="text-slate-400 mb-8">Create your first app to get started</p>
        </div>
      )}
    </div>
  );
}
