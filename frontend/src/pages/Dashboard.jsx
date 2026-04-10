import { API_BASE_URL } from "../config";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle, Activity, Clock, HeartPulse, User, AlertTriangle, ThermometerSun, Info, UserCheck, MessageSquare, PlusCircle } from 'lucide-react';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  // Mock initial state data to display when there are no logs
  const mockLogs = [
    {
      id: "mock1",
      timestamp: new Date(Date.now() - 5000).toISOString(),
      patient_sentiment: "Anxious",
      crisis_risk_level: "High",
      escalation_alert: true,
      clinical_summary: "Patient reported sharp pain in chest and high anxiety about the upcoming procedure.",
      type: "voice"
    },
    {
      id: "mock2",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      patient_sentiment: "Calm",
      crisis_risk_level: "Low",
      escalation_alert: false,
      clinical_summary: "Patient completed breathing exercise and felt calm.",
      type: "text"
    },
    {
      id: "mock3",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      patient_sentiment: "Frustrated",
      crisis_risk_level: "Medium",
      escalation_alert: false,
      clinical_summary: "Waiting for pain medication, expressing mild frustration.",
      type: "voice"
    }
  ];

  const fetchLogs = async () => {
    try {
      // console.log("[Dashboard] Fetching live patient logs...");
      
      const response = await axios.get(`${API_BASE_URL}/api/logs`);
      const data = response.data;
      
      const sorted = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      if (sorted.length > 0) {
        setLogs(sorted);
      } else {
        setLogs(mockLogs);
      }
    } catch (error) {
      console.error("\n================ DASHBOARD FETCH ERROR ==================");
      // ... leaving rest of error block alone
      setLogs(mockLogs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(); // 1. Get initial load of existing backlog
    
    // 2. Open an SSE connection instantly catching new data pushed from backend without polling
    
    const eventSource = new EventSource(`${API_BASE_URL}/api/logs/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const newLogEntry = JSON.parse(event.data);
        console.log("[Dashboard] SSE Realtime Push Received:", newLogEntry);
        setLogs(prev => {
          // Prepend new log pushing older ones down automatically instantly
          const updated = [newLogEntry, ...prev.filter(l => l.id !== newLogEntry.id)];
          return updated;
        });
      } catch (err) {
        console.error("Error parsing streaming log data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[Dashboard] Background SSE stream interrupted. Will auto-reconnect...", err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleAcknowledge = (id) => {
    setAcknowledgedAlerts(prev => ({ ...prev, [id]: true }));
  };

  // Derived state for widgets
  const latestLog = logs[0] || {};
  const currentEmotion = latestLog.patient_sentiment || 'Unknown';
  const crisisLevel = latestLog.crisis_risk_level || 'Low';
  const totalInterventions = logs.length;

  // Active alerts (escalation_alert true and not acknowledged)
  const activeAlerts = logs.filter(log => log.escalation_alert && !acknowledgedAlerts[log.id]);

  // Color mappings
  const emotionColor = (emotion) => {
    const e = emotion?.toLowerCase() || '';
    if (e.includes('calm') || e.includes('relaxed') || e.includes('positive')) return 'text-green-600 bg-green-50 border-green-200';
    if (e.includes('anxious') || e.includes('fear') || e.includes('frustrat')) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (e.includes('pain') || e.includes('anger') || e.includes('depress')) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const riskBadge = (level) => {
    const l = level?.toLowerCase() || 'low';
    if (l === 'high') return 'bg-red-100 text-red-800 border-red-200';
    if (l === 'medium') return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const riskBarColor = (level) => {
    const l = level?.toLowerCase() || 'low';
    if (l === 'high') return 'bg-red-500 w-full';
    if (l === 'medium') return 'bg-orange-400 w-2/3';
    return 'bg-green-400 w-1/3';
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans flex flex-col gap-6">
      
      {/* TOP HEADER (Patient Info) */}
      <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-200 shadow-sm">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              John Doe <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Room: 402</span>
            </h1>
            <p className="text-sm flex items-center gap-2 mt-1 font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse inline-block"></span>
              Status: Connected to MindBridge
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Activity className="w-6 h-6 text-indigo-500" />
           <span className="text-sm font-bold text-slate-700 tracking-wide uppercase">Clinical Command Center</span>
        </div>
      </header>

      {/* CRITICAL ALERT BANNER */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-md flex justify-between items-center animate-pulse duration-1000">
          <div className="flex items-start md:items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-bold text-lg leading-tight uppercase tracking-wide">🚨 Medical Escalation Required</h3>
              <p className="text-red-700 text-sm mt-0.5 font-medium">Patient requested physical assistance or reported pain.</p>
            </div>
          </div>
          <button 
            onClick={() => handleAcknowledge(activeAlerts[0].id)}
            className="bg-white text-red-700 border border-red-300 px-4 py-2 font-semibold text-sm rounded-lg hover:bg-red-50 transition-colors shadow-sm whitespace-nowrap"
          >
            Acknowledge / Clear
          </button>
        </div>
      )}

      {/* ANALYTICS WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Widget 1: Current Emotion */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Current Emotion</h3>
            <ThermometerSun className="w-5 h-5 text-slate-400" />
          </div>
          <div className={`mt-auto inline-block px-4 py-2 rounded-lg border-2 font-bold text-xl self-start ${emotionColor(currentEmotion)}`}>
            {currentEmotion}
          </div>
        </div>

        {/* Widget 2: Crisis Risk Level */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Crisis Risk Level</h3>
            <HeartPulse className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex items-end gap-3 mb-3">
            <span className={`px-3 py-1 text-sm font-bold uppercase rounded-md border shadow-sm ${riskBadge(crisisLevel)}`}>
              {crisisLevel}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mt-auto border border-slate-200 overflow-hidden">
            <div className={`h-2.5 rounded-full transition-all duration-500 ${riskBarColor(crisisLevel)}`}></div>
          </div>
        </div>

        {/* Widget 3: Total Interventions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Interventions</h3>
            <MessageSquare className="w-5 h-5 text-slate-400" />
          </div>
          <div className="mt-auto flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-indigo-600">{totalInterventions}</span>
            <span className="text-sm font-medium text-slate-500">interactions today</span>
          </div>
        </div>
      </div>

      {/* CLINICAL TIMELINE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-slate-200 p-5 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Clinical Timeline
          </h2>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
            Latest Summaries
          </span>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 font-medium">Loading clinical data...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-3">
               <UserCheck className="w-12 h-12 text-slate-200" />
               No clinical interactions recorded yet.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Time</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Risk Level</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Summary</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {logs.map((log) => {
                  const timeObj = new Date(log.timestamp);
                  const timeStr = timeObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
                  const dateStr = timeObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="font-semibold text-slate-800">{timeStr}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{dateStr}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-md border shadow-sm ${riskBadge(log.crisis_risk_level)}`}>
                          {log.crisis_risk_level || 'Low'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5 group-hover:text-indigo-400 transition-colors" />
                          <span className="text-sm font-medium text-slate-700 leading-relaxed">
                            {log.clinical_summary || log.userText || "No clinical summary available for this interaction."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
