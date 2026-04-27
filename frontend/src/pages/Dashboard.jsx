import { API_BASE_URL } from "../config";
import { useCallback, useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Clock, HeartPulse, User, AlertTriangle, ThermometerSun, Info, UserCheck, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard({ patientId, patientName = 'Patient' }) {
  const { authHeaders, currentUser } = useAuth();
  const activePatientId = patientId || currentUser?.id;
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  const fetchLogs = useCallback(async () => {
    try {
      if (!activePatientId) return;

      const response = await axios.get(`${API_BASE_URL}/api/logs/patient/${activePatientId}`, {
        headers: authHeaders,
      });
      const data = response.data;
      
      const sorted = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(sorted);
    } catch {
      console.error("\n================ DASHBOARD FETCH ERROR ==================");
      // ... leaving rest of error block alone
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [activePatientId, authHeaders]);

  useEffect(() => {
    if (!activePatientId || !currentUser) return undefined;
    fetchLogs(); // 1. Get initial load of existing backlog
    
    // 2. Open an SSE connection instantly catching new data pushed from backend without polling
    
    const streamParams = new URLSearchParams({
      patientId: activePatientId,
      userId: currentUser.id,
    });
    const eventSource = new EventSource(`${API_BASE_URL}/api/logs/stream?${streamParams.toString()}`);
    
    eventSource.onmessage = (event) => {
      try {
        const newLogEntry = JSON.parse(event.data);
        if (newLogEntry.patientId !== activePatientId) return;
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
  }, [activePatientId, currentUser, fetchLogs]);

  const handleAcknowledge = (id) => {
    setAcknowledgedAlerts(prev => ({ ...prev, [id]: true }));
  };

  // Derived state for widgets
  const latestLog = logs[0] || {};
  const currentEmotion = latestLog.patient_sentiment || 'Unknown';
  const crisisLevel = latestLog.crisis_risk_level || 'Low';
  const totalInterventions = logs.length;
  const latestVoiceExpressionLog = logs.find((log) => log.voice_expression_summary);
  const latestVoiceExpression =
    latestVoiceExpressionLog?.voice_expression_summary || 'No voice data yet';

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

  const voiceExpressionItems = (log) => {
    if (!Array.isArray(log.voice_expressions)) return [];
    return log.voice_expressions.slice(0, 3);
  };

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen font-sans flex flex-col gap-3 sm:gap-6 overflow-y-auto">
      
      {/* TOP HEADER (Patient Info) */}
      <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-200 shadow-sm shrink-0">
            <User className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
              <span className="truncate">{patientName}</span>
               <span className="text-xs sm:text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">{activePatientId}</span>
            </h1>
            <p className="text-xs sm:text-sm flex items-center gap-2 mt-0.5 sm:mt-1 font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse inline-block shrink-0"></span>
              <span className="truncate">Connected to MindBridge</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
           <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
           <span className="text-xs sm:text-sm font-bold text-slate-700 tracking-wide uppercase">Command Center</span>
        </div>
      </header>

      {/* CRITICAL ALERT BANNER */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 rounded-r-xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-pulse duration-1000">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-red-800 font-bold text-sm sm:text-lg leading-tight uppercase tracking-wide">Escalation Required</h3>
              <p className="text-red-700 text-xs sm:text-sm mt-0.5 font-medium">Patient requested assistance or reported pain.</p>
            </div>
          </div>
          <button 
            onClick={() => handleAcknowledge(activeAlerts[0].id)}
            className="bg-white text-red-700 border border-red-300 px-3 sm:px-4 py-1.5 sm:py-2 font-semibold text-xs sm:text-sm rounded-lg hover:bg-red-50 transition-colors shadow-sm whitespace-nowrap w-full sm:w-auto text-center"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* ANALYTICS WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Widget 1: Current Emotion */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">Current Emotion</h3>
            <ThermometerSun className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
          <div className={`mt-auto inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border-2 font-bold text-lg sm:text-xl self-start ${emotionColor(currentEmotion)}`}>
            {currentEmotion}
          </div>
        </div>

        {/* Widget 2: Crisis Risk Level */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">Crisis Risk Level</h3>
            <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
          <div className="flex items-end gap-3 mb-3">
            <span className={`px-3 py-1 text-xs sm:text-sm font-bold uppercase rounded-md border shadow-sm ${riskBadge(crisisLevel)}`}>
              {crisisLevel}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 sm:h-2.5 mt-auto border border-slate-200 overflow-hidden">
            <div className={`h-2 sm:h-2.5 rounded-full transition-all duration-500 ${riskBarColor(crisisLevel)}`}></div>
          </div>
        </div>

        {/* Widget 3: Total Interventions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">Interventions</h3>
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
          <div className="mt-auto flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-indigo-600">{totalInterventions}</span>
            <span className="text-xs sm:text-sm font-medium text-slate-500">today</span>
          </div>
        </div>

        {/* Widget 4: Expressions from Voice */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">Expressions from Voice</h3>
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          </div>
          <div className="mt-auto">
            <p className={`text-sm sm:text-base font-bold leading-snug ${latestVoiceExpressionLog ? 'text-indigo-700' : 'text-slate-400'}`}>
              {latestVoiceExpression}
            </p>
            {latestVoiceExpressionLog?.voice_expression_error && (
              <p className="text-xs text-slate-400 mt-1">Hume unavailable</p>
            )}
          </div>
        </div>
      </div>

      {/* CLINICAL TIMELINE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="border-b border-slate-200 p-3 sm:p-5 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" /> Timeline
          </h2>
          <span className="text-[10px] sm:text-xs font-semibold bg-slate-100 text-slate-600 px-2 sm:px-3 py-1 rounded-full border border-slate-200">
            Latest
          </span>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-8 sm:p-12 text-center text-slate-400 font-medium text-sm">Loading clinical data...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-3 text-sm">
               <UserCheck className="w-10 h-10 sm:w-12 sm:h-12 text-slate-200" />
               No clinical interactions recorded yet.
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {logs.map((log) => {
                  const timeObj = new Date(log.timestamp);
                  const timeStr = timeObj.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
                  const dateStr = timeObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  
                  return (
                    <div key={log.id} className="p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{timeStr}</span> · {dateStr}
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${riskBadge(log.crisis_risk_level)}`}>
                          {log.crisis_risk_level || 'Low'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed">
                        {log.clinical_summary || log.userText || "No summary available."}
                      </p>
                      {log.type === 'voice' && (
                        <div className="flex flex-wrap gap-1.5">
                          {voiceExpressionItems(log).length > 0 ? (
                            voiceExpressionItems(log).map((expression) => (
                              <span key={expression.name} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                {expression.name} {Math.round(expression.score * 100)}%
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              No voice expression data
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Desktop table layout */}
              <table className="min-w-full divide-y divide-slate-200 hidden sm:table">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Time</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Risk Level</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-56">Voice Expressions</th>
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
                          {log.type === 'voice' && voiceExpressionItems(log).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {voiceExpressionItems(log).map((expression) => (
                                <span key={expression.name} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
                                  {expression.name} {Math.round(expression.score * 100)}%
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">
                              {log.type === 'voice' ? 'No voice expression data' : 'Text interaction'}
                            </span>
                          )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
