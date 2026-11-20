import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOff, 
  Clock, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  MessageCircle, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Bot, 
  User, 
  RefreshCw, 
  Radio, 
  Download,
  Volume2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';

interface CallLog {
  id: string;
  call_id: string;
  lead_name: string;
  lead_phone: string;
  status: string;
  duration: number;
  sentiment: string;
  transcript: string;
  recording_url: string;
  summary: string;
  checklist: string[];
  sms_status: string;
  sms_content: string;
  created_at: string;
  campaign_id: string;
  provider?: string;
}

interface CallStats {
  total_calls: number;
  total_duration: number;
  answered_calls: number;
  failed_calls: number;
  in_progress_calls: number;
  meetings_booked: number;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTotalDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function normalizeDateStr(dateStr: string): string {
  if (!dateStr) return '';
  let str = dateStr.trim();
  if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
    str = `${str}Z`;
  }
  return str;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(normalizeDateStr(dateStr));
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSecs < 45) return 'Just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatExactTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(normalizeDateStr(dateStr));
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return 'Unknown Number';
  let clean = phone.trim();
  if (clean.startsWith('+91') && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  return clean;
}

export default function Calls() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [stats, setStats] = useState<CallStats>({ 
    total_calls: 0, 
    total_duration: 0, 
    answered_calls: 0, 
    failed_calls: 0, 
    in_progress_calls: 0, 
    meetings_booked: 0 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'answered' | 'failed' | 'in-progress'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const userId = user?.user_id || 'user_12345_john_doe';

  const fetchCallData = async () => {
    setIsLoading(true);
    try {
      let url = `/api/campaigns/voice/calls?user_id=${userId}`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const [callsData, statsData] = await Promise.all([
        apiFetch(url),
        apiFetch(`/api/campaigns/voice/stats?user_id=${userId}`),
      ]);

      setCalls(callsData.calls || []);
      setStats({
        total_calls: statsData.total_calls || 0,
        total_duration: statsData.total_duration || 0,
        answered_calls: statsData.answered_calls || 0,
        failed_calls: statsData.failed_calls || 0,
        in_progress_calls: statsData.in_progress_calls || 0,
        meetings_booked: statsData.meetings_booked || 0,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch call data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCallData();
    // Auto-refresh every 12 seconds for live campaign progress
    const interval = setInterval(fetchCallData, 12000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCallData();
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'completed' || s === 'answered' || s === 'ended' || s === 'fulfilled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Answered
        </span>
      );
    }
    if (s === 'failed' || s === 'no-answer' || s === 'busy' || s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          Failed / Missed
        </span>
      );
    }
    if (s === 'in-progress' || s === 'calling' || s === 'ringing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          Calling Now
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        Queued
      </span>
    );
  };

  const sentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Positive': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Negative': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Helper to parse multi-turn transcript into structured bubbles
  const renderTranscriptBubbles = (rawTranscript: string, leadName: string) => {
    if (!rawTranscript || !rawTranscript.trim()) {
      return (
        <div className="p-4 bg-white rounded-xl border border-gray-200 text-center text-sm text-gray-500">
          <AlertCircle className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
          No transcript turns recorded. Recipient did not answer or call dropped before audio stream started.
        </div>
      );
    }

    const lines = rawTranscript.split('\n').filter(l => l.trim().length > 0);
    return (
      <div className="space-y-3 bg-white p-4 rounded-xl border border-[#F2DED6] max-h-72 overflow-y-auto">
        {lines.map((line, idx) => {
          const isAgent = line.startsWith('Agent') || line.toLowerCase().includes('agent:') || line.includes('नरेश:');
          const cleanText = line.replace(/^(Agent|Prospect|User|Lead)(\s*\(.*?\))?:\s*/i, '').trim();

          return (
            <div 
              key={idx} 
              className={`flex items-start gap-2.5 ${isAgent ? 'justify-start' : 'justify-end'}`}
            >
              {isAgent && (
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div 
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  isAgent 
                    ? 'bg-[#FAF8F5] text-gray-900 border border-[#F2DED6] rounded-tl-sm' 
                    : 'bg-primary text-white rounded-tr-sm'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                  {isAgent ? 'AI Agent (नरेश)' : (leadName || 'Lead / Prospect')}
                </div>
                <p className="whitespace-pre-wrap">{cleanText || line}</p>
              </div>
              {!isAgent && (
                <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const pickupRate = stats.total_calls > 0 ? Math.round((stats.answered_calls / stats.total_calls) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#F2DED6] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">AI Voice Call Logs</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telephony (LiveKit + Vobiz SIP)
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Real-time transparency into your outbound calling campaigns, transcripts, audio recordings, and customer sentiment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:inline">
            Updated {timeAgo(lastRefreshed.toISOString())}
          </span>
          <button
            onClick={fetchCallData}
            disabled={isLoading}
            className="bg-[#FAF8F5] border border-[#F2DED6] hover:bg-gray-100 text-gray-800 px-4 py-2 rounded-xl font-medium text-sm transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : 'text-gray-600'}`} />
            {isLoading ? 'Syncing...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {/* Top 5 Metrics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Calls Made */}
        <div className="bg-white rounded-2xl p-5 border border-[#F2DED6] shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <PhoneCall className="w-5 h-5 text-primary" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Calls Dialed</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-gray-900">{stats.total_calls.toLocaleString()}</p>
            <span className="text-[11px] font-semibold text-gray-400">leads</span>
          </div>
        </div>

        {/* Answered / Received */}
        <div className="bg-white rounded-2xl p-5 border border-[#F2DED6] shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <PhoneIncoming className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Answered / Received</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-emerald-700">{stats.answered_calls.toLocaleString()}</p>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {pickupRate}% pickup
            </span>
          </div>
        </div>

        {/* Failed / Missed */}
        <div className="bg-white rounded-2xl p-5 border border-[#F2DED6] shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center mb-3">
            <PhoneOff className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Failed / Missed</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-rose-700">{stats.failed_calls.toLocaleString()}</p>
            <span className="text-[11px] font-medium text-gray-400">no answer</span>
          </div>
        </div>

        {/* Total Talk Time */}
        <div className="bg-white rounded-2xl p-5 border border-[#F2DED6] shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Talk Time</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-gray-900">{formatTotalDuration(stats.total_duration)}</p>
            <span className="text-[11px] font-medium text-gray-400">in conversation</span>
          </div>
        </div>

        {/* Positive Outcomes */}
        <div className="bg-white rounded-2xl p-5 border border-[#F2DED6] shadow-sm col-span-2 md:col-span-1">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Positive Outcomes</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-purple-700">{stats.meetings_booked.toLocaleString()}</p>
            <span className="text-[11px] font-semibold text-purple-600">interested</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#F2DED6] shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAF8F5] rounded-xl border border-[#F2DED6]/70 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-white text-gray-900 shadow-sm border border-[#F2DED6]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All Calls ({stats.total_calls})
          </button>
          <button
            onClick={() => setStatusFilter('answered')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'answered'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Answered ({stats.answered_calls})
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'failed'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-rose-700'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Failed / Missed ({stats.failed_calls})
          </button>
          <button
            onClick={() => setStatusFilter('in-progress')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'in-progress'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-amber-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            In Progress ({stats.in_progress_calls})
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead, phone, summary..."
            className="w-full bg-[#FAF8F5] border border-[#F2DED6] rounded-xl pl-9 pr-20 py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-50 border border-[#F2DED6] px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 shadow-xs"
          >
            Search
          </button>
        </form>
      </div>

      {/* Call Logs Master Container */}
      <div className="bg-white rounded-2xl border border-[#F2DED6] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#F2DED6] bg-[#FAF8F5] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-900 text-sm">Call Activity Stream</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              {calls.length} {calls.length === 1 ? 'call' : 'calls'} listed
            </span>
          </div>
          <span className="text-xs text-gray-500 hidden sm:inline">
            Click any row to expand full dialogue transcript & AI summary
          </span>
        </div>

        {isLoading && calls.length === 0 ? (
          <div className="p-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">Loading call records...</p>
            <p className="text-xs text-gray-400 mt-1">Connecting to MongoDB telephony logs...</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="p-16 text-center">
            <PhoneCall className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-bold text-gray-800 mb-1">No call records found</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'all' 
                ? 'No calls match the current search or status filter. Try clearing the filters.' 
                : 'Start a voice campaign from the Campaigns page to begin dialing leads.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F2DED6]/60">
            {calls.map((call) => {
              const isExpanded = expandedCall === call.call_id;
              const initials = (call.lead_name || 'Prospect')
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div key={call.id || call.call_id} className="transition-colors">
                  {/* Call Summary Row */}
                  <div
                    onClick={() => setExpandedCall(isExpanded ? null : call.call_id)}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-6 sm:py-4 gap-3 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-[#FAF8F5]' : 'hover:bg-[#FDFBF9]'
                    }`}
                  >
                    {/* Left: Lead Identity */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm truncate">{call.lead_name || 'Unknown Contact'}</p>
                          {call.provider && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-mono">
                              {call.provider}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{formatPhoneDisplay(call.lead_phone)}</p>
                      </div>
                    </div>

                    {/* Middle: Metrics and Badges */}
                    <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Duration */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white px-2.5 py-1 rounded-lg border border-[#F2DED6] shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatDuration(call.duration)}</span>
                      </div>

                      {/* Status */}
                      <div>{getStatusBadge(call.status)}</div>

                      {/* Sentiment */}
                      {call.sentiment && (
                        <div className="hidden md:block">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${sentimentColor(call.sentiment)}`}>
                            {call.sentiment}
                          </span>
                        </div>
                      )}

                      {/* Timestamp */}
                      <div 
                        className="text-xs text-gray-500 hidden lg:flex flex-col items-end text-right w-24 shrink-0" 
                        title={call.created_at ? new Date(normalizeDateStr(call.created_at)).toLocaleString() : ''}
                      >
                        <span className="font-semibold text-gray-700">{timeAgo(call.created_at)}</span>
                        <span className="text-[10px] text-gray-400">{formatExactTime(call.created_at)}</span>
                      </div>

                      {/* Audio listen button if recording available */}
                      {call.recording_url && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <a
                            href={call.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            Listen
                          </a>
                        </div>
                      )}

                      {/* Expand Chevron */}
                      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Call Details Drawer */}
                  {isExpanded && (
                    <div className="px-4 sm:px-6 pb-6 pt-2 bg-[#FAF8F5] border-t border-[#F2DED6] space-y-5">
                      {/* Audio Recording Player */}
                      {call.recording_url && (
                        <div className="bg-white p-4 rounded-xl border border-[#F2DED6] shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                              <Volume2 className="w-4 h-4 text-primary" /> Call Audio Recording
                            </h4>
                            <a
                              href={call.recording_url}
                              download
                              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" /> Download Audio
                            </a>
                          </div>
                          <audio controls className="w-full h-10 mt-1 rounded-lg">
                            <source src={call.recording_url} type="audio/wav" />
                            <source src={call.recording_url} type="audio/mpeg" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}

                      {/* Conversational Transcript */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-primary" /> Full Conversation Transcript
                          </h4>
                          <span className="text-[11px] text-gray-400">
                            Hindi Speech (Deepgram STT & Cartesia Sonic-3)
                          </span>
                        </div>
                        {renderTranscriptBubbles(call.transcript, call.lead_name)}
                      </div>

                      {/* AI Summary and Action Items Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* AI Summary */}
                        <div className="bg-white p-4 rounded-xl border border-[#F2DED6] shadow-sm">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> AI Executive Summary
                          </h4>
                          {call.summary ? (
                            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                              {call.summary}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">
                              Summary will be synthesized automatically once dialog turns are completed.
                            </p>
                          )}
                        </div>

                        {/* Action Items */}
                        <div className="bg-white p-4 rounded-xl border border-[#F2DED6] shadow-sm">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Action Items & Next Steps
                          </h4>
                          {call.checklist && call.checklist.length > 0 ? (
                            <ul className="space-y-1.5">
                              {call.checklist.map((item, idx) => (
                                <li key={idx} className="text-xs sm:text-sm text-gray-700 flex items-start gap-2">
                                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-400 italic">
                              No action items flagged.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Follow-up SMS / WhatsApp Section */}
                      {call.sms_status && (
                        <div className="bg-white p-4 rounded-xl border border-[#F2DED6] shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                              <MessageCircle className="w-3.5 h-3.5 text-blue-600" /> Follow-up SMS / WhatsApp
                            </h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              call.sms_status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {call.sms_status === 'sent' ? 'Delivered' : 'Failed to send'}
                            </span>
                          </div>
                          {call.sms_content && (
                            <p className="text-xs text-gray-700 font-mono bg-[#FAF8F5] p-2.5 rounded-lg border border-[#F2DED6]/70">
                              {call.sms_content}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Technical Call Metadata Footer */}
                      <div className="pt-2 border-t border-[#F2DED6]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 font-mono">
                        <div>Room / Call ID: <span className="text-gray-600 select-all">{call.call_id}</span></div>
                        <div>Telephony: <span className="text-gray-600">Vobiz SIP (+917965853227)</span></div>
                        <div>TTS Voice: <span className="text-gray-600">Cartesia Sonic-3 Hindi (0.85x)</span></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
