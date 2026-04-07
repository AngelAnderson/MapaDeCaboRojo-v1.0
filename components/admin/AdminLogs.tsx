
import React from 'react';
import { AdminLog } from '../../types';

interface AdminLogsProps {
  logs: AdminLog[];
}

export const AdminLogs: React.FC<AdminLogsProps> = ({ logs }) => (
  <div className="p-4 max-w-5xl mx-auto h-full overflow-y-auto">
    <h2 className="text-2xl font-bold text-white mb-4">System Logs</h2>
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
          <tr>
            <th className="px-6 py-3">Time</th>
            <th className="px-6 py-3">Action</th>
            <th className="px-6 py-3">Target</th>
            <th className="px-6 py-3">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-700/50 transition-colors">
              <td className="px-6 py-4 font-mono text-xs text-slate-500">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    log.action === 'DELETE'
                      ? 'bg-red-900/30 text-red-400'
                      : log.action === 'CREATE'
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-blue-900/30 text-blue-400'
                  }`}
                >
                  {log.action}
                </span>
              </td>
              <td className="px-6 py-4 font-bold text-white">{log.place_name}</td>
              <td className="px-6 py-4 text-xs text-slate-400 truncate max-w-xs">{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <i className="fa-solid fa-scroll text-3xl mb-3"></i>
          <p className="text-sm">No logs yet.</p>
        </div>
      )}
    </div>
  </div>
);
