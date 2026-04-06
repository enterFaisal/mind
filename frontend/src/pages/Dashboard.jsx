import { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle, Activity, Clock, FileText, Mic } from 'lucide-react';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/logs');
      // Sort backwards by timestamp so newest is top
      const sorted = response.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(sorted);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Setting up polling for real-time dashboard feel (every 3 secs)
    const intervalId = setInterval(fetchLogs, 3000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="p-6 bg-gray-50 flex-1 min-h-[calc(100vh-80px)] mt-4 shadow-sm border border-gray-200 rounded-xl relative -top-3">
      <div className="mb-6 flex justify-between items-end border-b pb-4 border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="text-indigo-600" /> Medical Staff Dashboard
          </h2>
          <p className="text-gray-500 mt-1">Live monitoring of patient interactions and emotional states.</p>
        </div>
        <div className="text-sm px-4 py-1.5 rounded-full bg-green-100 text-green-700 font-bold border border-green-200 flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse block"></span> Live Polling
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 font-medium">Loading Patient Logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-medium flex flex-col items-center gap-3">
            <CheckCircle className="w-12 h-12 text-gray-200" />
            No recent interactions. Everything is peaceful.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sentiment</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient Input</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Alert Level</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => {
                const isAlert = log.escalation_alert;
                const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit' });

                return (
                  <tr key={log.id} className={isAlert ? 'bg-red-50/40 hover:bg-red-50 transition-colors' : 'hover:bg-gray-50 transition-colors'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 flex items-center gap-2">
                       <Clock className="w-4 h-4 text-gray-400" /> {timeStr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.type === 'voice' ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 gap-1 items-center">
                           <Mic className="w-3 h-3" /> Voice
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 gap-1 items-center">
                           <FileText className="w-3 h-3" /> Text
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 border px-3 py-1 rounded-full bg-gray-50">{log.patient_sentiment}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">
                      "{log.userText}"
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isAlert ? (
                        <span className="px-3 py-1.5 inline-flex text-xs leading-5 font-bold rounded-lg bg-red-100 text-red-800 gap-1.5 items-center border border-red-200 shadow-sm">
                           <ShieldAlert className="w-4 h-4" /> Escalation Needed
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 inline-flex text-xs leading-5 font-bold rounded-lg bg-green-100 text-green-800 gap-1.5 items-center border border-green-200">
                           <CheckCircle className="w-4 h-4" /> Normal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
