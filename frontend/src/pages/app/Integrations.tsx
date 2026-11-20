import { useState, useEffect } from 'react';
import { Search, CheckCircle2, Settings, Link2, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';

const initialIntegrations = [
  { id: 'twilio', name: 'Twilio', category: 'Communications', desc: 'SMS and Voice infrastructure (International calling)', status: 'available', logo: 'https://www.vectorlogo.zone/logos/twilio/twilio-icon.svg' },
  { id: 'vobiz', name: 'Vobiz (India Telephony)', category: 'Communications', desc: 'Indian Cloud Telephony & SIP Trunking for +91 calling', status: 'available', logo: 'https://cdn-icons-png.flaticon.com/512/3616/3616215.png' },
  { id: 'sip', name: 'Custom SIP Trunk (BYOC)', category: 'Communications', desc: 'Connect Telnyx, Tata, Bandwidth, Airtel, or Asterisk/FreePBX for custom carrier routing', status: 'available', logo: 'https://cdn-icons-png.flaticon.com/512/1086/1086581.png' },
  { id: 'linkedin', name: 'LinkedIn', category: 'Channels', desc: 'Automate LinkedIn outreach', status: 'available', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png' },
  { id: 'gmail', name: 'Google Workspace / Gmail', category: 'Channels', desc: 'Send and receive emails', status: 'available', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg' },
  { id: 'outlook', name: 'Microsoft Outlook', category: 'Channels', desc: 'Connect your Office 365 / Outlook account', status: 'available', logo: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg' },
  { id: 'smtp', name: 'Custom SMTP', category: 'Channels', desc: 'Connect any email provider via SMTP credentials', status: 'available', logo: 'https://cdn-icons-png.flaticon.com/512/2950/2950689.png' },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'Channels', desc: 'WhatsApp API integration', status: 'available', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg' },
];

export default function Integrations() {
  const { user, checkSession } = useAuth();
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [showEmailModal, setShowEmailModal] = useState<string | null>(null);
  const [emailForm, setEmailForm] = useState({ host: '', port: '', email: '', password: '' });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [twilioForm, setTwilioForm] = useState({ account_sid: '', auth_token: '', from_number: '' });
  const [showVobizModal, setShowVobizModal] = useState(false);
  const [vobizForm, setVobizForm] = useState({ sip_domain: '', username: '', password: '', outbound_number: '' });
  const [showSipModal, setShowSipModal] = useState(false);
  const [sipForm, setSipForm] = useState({ sip_domain: '', username: '', password: '', outbound_number: '', transport: 'UDP' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showWaModal, setShowWaModal] = useState(false);
  const [waMode, setWaMode] = useState<'meta' | 'qr'>('meta');
  const [waMetaForm, setWaMetaForm] = useState({
    access_token: '',
    phone_number_id: '',
    waba_id: '',
    from_phone_number: '',
  });
  const [waQrData, setWaQrData] = useState<{session_id: string, qr_code?: string} | null>(null);
  const [isWaLoading, setIsWaLoading] = useState(false);

  // 1. Handle OAuth redirects & clear query string so sticky success/error params don't persist
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success) {
      window.history.replaceState({}, document.title, window.location.pathname);
      checkSession();
    } else if (error) {
      window.history.replaceState({}, document.title, window.location.pathname);
      alert(`Integration error: ${error}`);
    }
  }, []);

  // 2. Synchronize integration cards accurately with user.integrations from MongoDB & live checks
  useEffect(() => {
    const userIntegrations = user?.integrations || {};
    setIntegrations(initialIntegrations.map(int => {
      const isConnected = !!userIntegrations[int.id];
      return {
        ...int,
        status: isConnected ? 'connected' : 'available'
      };
    }));

    // Auto-verify live WhatsApp status if user session exists
    if (user?.user_id) {
      apiFetch(`/api/whatsapp/status/user_${user.user_id}`)
        .then(res => {
          if (res?.connection_state === 'CONNECTED') {
            setIntegrations(prev => prev.map(int => int.id === 'whatsapp' ? { ...int, status: 'connected' } : int));
          } else if (res?.connection_state === 'DISCONNECTED') {
            setIntegrations(prev => prev.map(int => int.id === 'whatsapp' ? { ...int, status: 'available' } : int));
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleConnect = async (id: string) => {
    if (id === 'linkedin') {
      try {
        const currentUserId = user?.user_id || "user_12345_john_doe";
        const frontendUrl = window.location.origin;
        
        // Pass the user_id and frontend_url to the backend so it can be passed through the OAuth state
        const data = await apiFetch(`/api/integrations/linkedin/login?user_id=${currentUserId}&frontend_url=${encodeURIComponent(frontendUrl)}`);
        if (data.auth_url) {
          window.location.href = data.auth_url; // Redirect to LinkedIn OAuth
        }
      } catch (err) {
        console.error("Failed to fetch LinkedIn auth URL", err);
        alert("Failed to connect to LinkedIn.");
      }
      return;
    }

    if (id === 'gmail') {
      try {
        const currentUserId = user?.user_id || "user_12345_john_doe";
        const frontendUrl = window.location.origin;
        const data = await apiFetch(`/api/integrations/google/login?user_id=${currentUserId}&frontend_url=${encodeURIComponent(frontendUrl)}`);
        if (data.auth_url) {
          window.location.href = data.auth_url; // Redirect directly to Google Workspace login
        }
      } catch (err) {
        console.error("Failed to fetch Google Workspace auth URL", err);
        alert("Failed to connect to Google Workspace.");
      }
      return;
    }

    if (['outlook', 'smtp'].includes(id)) {
      setEmailError(null);
      setShowEmailModal(id);
      return;
    }

    if (id === 'twilio') {
      setShowTwilioModal(true);
      return;
    }

    if (id === 'vobiz') {
      setShowVobizModal(true);
      return;
    }

    if (id === 'sip') {
      setShowSipModal(true);
      return;
    }

    if (id === 'whatsapp') {
      setShowWaModal(true);
      return;
    }

    // Mock connection for others
    setIntegrations(prev => prev.map(int => 
      int.id === id ? { ...int, status: 'connected' } : int
    ));
    alert(`Successfully connected ${id}!`);
  };

  const submitEmailConnect = async () => {
    setIsConnecting(true);
    setEmailError(null);
    try {
      const data = await apiFetch('/api/integrations/email/connect', {
        method: 'POST',
        bodyData: {
          provider: showEmailModal,
          user_id: user?.user_id,
          ...emailForm
        }
      });
      if (data.status === 'success' || data.success) {
        await checkSession();
        setIntegrations(prev => prev.map(int => int.id === showEmailModal ? { ...int, status: 'connected' } : int));
        setShowEmailModal(null);
        setEmailForm({ host: '', port: '', email: '', password: '' });
        alert(data.message || 'Successfully connected! Credentials verified.');
      } else {
        setEmailError(data.message || 'Failed to connect email provider');
      }
    } catch (err: any) {
      console.error(err);
      setEmailError(err.message || 'Verification failed. Please check host, port, email, and password.');
    } finally {
      setIsConnecting(false);
    }
  };

  const submitTwilioConnect = async () => {
    setIsConnecting(true);
    try {
      const data = await apiFetch('/api/integrations/twilio/connect', {
        method: 'POST',
        bodyData: {
          user_id: user?.user_id,
          ...twilioForm
        }
      });
      if (data.status === 'success' || data.success) {
        await checkSession();
        setIntegrations(prev => prev.map(int => int.id === 'twilio' ? { ...int, status: 'connected' } : int));
        setShowTwilioModal(false);
        setTwilioForm({ account_sid: '', auth_token: '', from_number: '' });
        alert(`Successfully connected Twilio! You can now send SMS and International Voice Campaigns.`);
      } else {
        alert(data.message || 'Failed to connect');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Network error connecting Twilio');
    } finally {
      setIsConnecting(false);
    }
  };

  const submitVobizConnect = async () => {
    setIsConnecting(true);
    try {
      const data = await apiFetch('/api/integrations/vobiz/connect', {
        method: 'POST',
        bodyData: {
          user_id: user?.user_id,
          ...vobizForm
        }
      });
      if (data.status === 'success' || data.success) {
        await checkSession();
        setIntegrations(prev => prev.map(int => int.id === 'vobiz' ? { ...int, status: 'connected' } : int));
        setShowVobizModal(false);
        setVobizForm({ sip_domain: '', username: '', password: '', outbound_number: '' });
        alert(`Successfully connected Vobiz! India outbound calls (+91) will now route through your Vobiz SIP Trunk.`);
      } else {
        alert(data.message || 'Failed to connect Vobiz');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Network error connecting Vobiz');
    } finally {
      setIsConnecting(false);
    }
  };

  const submitSipConnect = async () => {
    setIsConnecting(true);
    try {
      const data = await apiFetch('/api/integrations/sip/connect', {
        method: 'POST',
        bodyData: {
          user_id: user?.user_id,
          ...sipForm
        }
      });
      if (data.status === 'success' || data.success) {
        await checkSession();
        setIntegrations(prev => prev.map(int => int.id === 'sip' ? { ...int, status: 'connected' } : int));
        setShowSipModal(false);
        setSipForm({ sip_domain: '', username: '', password: '', outbound_number: '', transport: 'UDP' });
        alert(`Successfully connected Custom SIP Trunk! Calling agents can now route calls via your carrier.`);
      } else {
        alert(data.message || 'Failed to connect Custom SIP Trunk');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Network error connecting Custom SIP Trunk');
    } finally {
      setIsConnecting(false);
    }
  };

  const submitWaMetaConnect = async () => {
    setIsConnecting(true);
    try {
      const data = await apiFetch('/api/integrations/whatsapp/meta/connect', {
        method: 'POST',
        bodyData: {
          user_id: user?.user_id,
          ...waMetaForm
        }
      });
      if (data.status === 'success' || data.success) {
        await checkSession();
        setIntegrations(prev => prev.map(int => int.id === 'whatsapp' ? { ...int, status: 'connected' } : int));
        setShowWaModal(false);
        setWaMetaForm({ access_token: '', phone_number_id: '', waba_id: '', from_phone_number: '' });
        alert(data.message || 'Successfully connected WhatsApp Business Meta Cloud API!');
      } else {
        alert(data.message || 'Failed to connect Meta WhatsApp');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error verifying Meta WhatsApp credentials');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/integrations/verify', {
        method: 'POST',
        bodyData: {
          provider: providerId,
          user_id: user?.user_id
        }
      });
      setTestResult({
        success: res.success,
        message: res.message || (res.success ? 'Connection verified!' : 'Connection check failed.')
      });
      if (!res.success) {
        setIntegrations(prev => prev.map(int => int.id === providerId ? { ...int, status: 'error' } : int));
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection check failed. Server unreachable.'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    setIsDisconnecting(true);
    try {
      const data = await apiFetch('/api/integrations/disconnect', {
        method: 'POST',
        bodyData: { 
          provider: providerId,
          user_id: user?.user_id
        }
      });
      if (data.status === 'success' || data.success) {
        await checkSession();
        setIntegrations(prev => prev.map(int => int.id === providerId ? { ...int, status: 'available' } : int));
        setShowConfigModal(null);
        setTestResult(null);
        alert(`Successfully disconnected ${providerId}!`);
      } else {
        alert(data.message || 'Failed to disconnect');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Network error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const startWaSession = async () => {
    setIsWaLoading(true);
    setWaQrData(null);
    try {
      const data = await apiFetch('/api/whatsapp/connect', {
        method: 'POST',
      });
      if (data.session_id) {
        setWaQrData({
          session_id: data.session_id,
          qr_code: data.data?.qr || null 
        });
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Network error connecting WhatsApp');
      setShowWaModal(false);
    }
    setIsWaLoading(false);
  };

  useEffect(() => {
    let interval: any;
    if (showWaModal && waQrData?.session_id) {
      interval = setInterval(async () => {
        try {
          const data = await apiFetch(`/api/whatsapp/status/${waQrData.session_id}`);
          if (data.connection_state === 'CONNECTED') {
            setIntegrations(prev => prev.map(int => int.id === 'whatsapp' ? { ...int, status: 'connected' } : int));
            setShowWaModal(false);
            await checkSession();
            alert('Successfully connected WhatsApp!');
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [showWaModal, waQrData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrations</h1>
          <p className="text-sm text-gray-500">Connect Genquantaa with your email channels, SMS providers, and external tools.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search integrations..."
            className="w-full bg-white border border-[#F2DED6] rounded-lg py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary shadow-sm outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2 pb-4 overflow-x-auto hide-scrollbar">
        {['All', 'Channels', 'Communications'].map((category, i) => (
          <button key={i} className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors border shadow-sm ${
            i === 0 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-[#F2DED6] hover:text-gray-900 hover:bg-gray-50'
          }`}>
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {integrations.map((integration) => (
          <div key={integration.id} className="bg-white hover:shadow-md transition-shadow rounded-xl p-6 border border-[#F2DED6] shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center p-2 border border-gray-100 shadow-sm">
                <div className="w-full h-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${integration.logo})` }} />
              </div>
              {integration.status === 'connected' ? (
                <span className="flex items-center text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full border border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
                </span>
              ) : integration.status === 'error' ? (
                <span className="flex items-center text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" /> Needs Reconnect
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                  Available
                </span>
              )}
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{integration.name}</h3>
            <p className="text-sm text-gray-500 mb-6 flex-1">{integration.desc}</p>
            
            <div className="pt-4 border-t border-[#F2DED6] flex gap-2">
              {integration.status === 'connected' || integration.status === 'error' ? (
                <div className="w-full space-y-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setTestResult(null);
                        setShowConfigModal(integration.id);
                      }}
                      className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-[#F2DED6] rounded-lg transition-colors shadow-sm">
                      <Settings className="w-4 h-4 mr-2 text-gray-500" />
                      {integration.status === 'error' ? 'Fix Connection' : 'Configure'}
                    </button>
                    <button 
                      onClick={() => handleTestConnection(integration.id)}
                      title="Quick Health Test"
                      className="p-2 text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 border border-[#F2DED6] rounded-lg transition-colors shadow-sm">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  {integration.id === 'linkedin' && (
                    <div className="p-2 bg-gray-50 border border-gray-100 rounded-lg mt-2">
                      <p className="text-xs text-gray-500 font-mono break-all">
                        <span className="font-semibold text-gray-700">User:</span> {user?.email || user?.user_id}<br />
                        <span className="font-semibold text-gray-700">Token:</span> Active
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => handleConnect(integration.id)} className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm">
                  <Link2 className="w-4 h-4 mr-2" /> Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Email Connect Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-1 text-gray-900">
              Connect {integrations.find(i => i.id === showEmailModal)?.name}
            </h2>
            <p className="text-xs text-gray-500 mb-4">Credentials will be validated immediately before saving to ensure active deliverability.</p>
            
            {emailError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">{emailError}</div>
              </div>
            )}

            <div className="space-y-4">
              {showEmailModal === 'smtp' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">SMTP Host</label>
                    <input type="text" className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary" value={emailForm.host} onChange={e => setEmailForm({...emailForm, host: e.target.value})} placeholder="smtp.example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">SMTP Port</label>
                    <input type="text" className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary" value={emailForm.port} onChange={e => setEmailForm({...emailForm, port: e.target.value})} placeholder="587" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Email Address</label>
                <input type="email" className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary" value={emailForm.email} onChange={e => setEmailForm({...emailForm, email: e.target.value})} placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">App Password / Password</label>
                <input type="password" className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary" value={emailForm.password} onChange={e => setEmailForm({...emailForm, password: e.target.value})} placeholder="Enter secure app password" />
                <p className="text-xs text-gray-500 mt-2">
                  {showEmailModal === 'outlook' 
                    ? "For Microsoft 365 / Outlook, please generate an App Password or ensure SMTP AUTH is permitted for this account."
                    : "For Gmail/Google accounts, you must use a 16-character App Password (myaccount.google.com/apppasswords), or use the Google Workspace button to authenticate with OAuth."
                  }
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => { setShowEmailModal(null); setEmailError(null); }} className="px-4 py-2 border border-[#F2DED6] hover:bg-gray-50 rounded-lg text-gray-600 font-medium transition-colors">Cancel</button>
              <button onClick={submitEmailConnect} disabled={isConnecting || !emailForm.email || !emailForm.password} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-50 transition-colors shadow-sm">
                 {isConnecting ? (
                   <>
                     <Loader2 className="w-4 h-4 animate-spin" />
                     Verifying & Connecting...
                   </>
                 ) : 'Verify & Connect Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Twilio Connect Modal */}
      {showTwilioModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Connect Twilio</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Account SID</label>
                <input type="text" className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono" value={twilioForm.account_sid} onChange={e => setTwilioForm({...twilioForm, account_sid: e.target.value})} placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Auth Token</label>
                <input type="password" className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono" value={twilioForm.auth_token} onChange={e => setTwilioForm({...twilioForm, auth_token: e.target.value})} placeholder="your_auth_token" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">From Phone Number</label>
                <input type="text" className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono" value={twilioForm.from_number} onChange={e => setTwilioForm({...twilioForm, from_number: e.target.value})} placeholder="+1234567890" />
                <p className="text-xs text-gray-500 mt-2">Enter your Twilio phone number in E.164 format (e.g., +1234567890).</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setShowTwilioModal(false)} className="px-4 py-2 border border-[#F2DED6] hover:bg-gray-50 rounded-lg text-gray-600 font-medium transition-colors">Cancel</button>
              <button onClick={submitTwilioConnect} disabled={isConnecting || !twilioForm.account_sid || !twilioForm.auth_token || !twilioForm.from_number} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-50 transition-colors shadow-sm">
                 {isConnecting ? (
                   <>
                     <Loader2 className="w-4 h-4 animate-spin" />
                     Saving...
                   </>
                 ) : 'Connect Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vobiz (India Telephony) Connect Modal */}
      {showVobizModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900">Connect Vobiz Account</h2>
              <span className="text-xs bg-orange-100 text-orange-800 font-semibold px-2 py-0.5 rounded">India Telephony</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Enter your Vobiz SIP credentials to route outbound voice calls to Indian prospects (+91) at local domestic rates.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">SIP Domain / Host</label>
                <input
                  type="text"
                  className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  value={vobizForm.sip_domain}
                  onChange={e => setVobizForm({...vobizForm, sip_domain: e.target.value})}
                  placeholder="your-domain.sip.vobiz.ai"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">Auth Username / User ID</label>
                <input
                  type="text"
                  className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  value={vobizForm.username}
                  onChange={e => setVobizForm({...vobizForm, username: e.target.value})}
                  placeholder="vobiz_username"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">Auth Password / Secret</label>
                <input
                  type="password"
                  className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  value={vobizForm.password}
                  onChange={e => setVobizForm({...vobizForm, password: e.target.value})}
                  placeholder="••••••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">Outbound Number / DID</label>
                <input
                  type="text"
                  className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  value={vobizForm.outbound_number}
                  onChange={e => setVobizForm({...vobizForm, outbound_number: e.target.value})}
                  placeholder="+917965853227"
                />
                <p className="text-xs text-gray-500 mt-1">TRAI-compliant Indian CLI number in E.164 format (+91...).</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowVobizModal(false)}
                className="px-4 py-2 border border-[#F2DED6] hover:bg-gray-50 rounded-lg text-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitVobizConnect}
                disabled={isConnecting || !vobizForm.sip_domain || !vobizForm.username || !vobizForm.password || !vobizForm.outbound_number}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-50 transition-colors shadow-sm"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Linking Trunk...
                  </>
                ) : 'Connect Vobiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom SIP Trunk (BYOC) Connect Modal */}
      {showSipModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900">Connect Custom SIP Trunk</h2>
              <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">BYOC Telephony</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Bring Your Own Carrier (Telnyx, Tata Communications, Bandwidth, Airtel, or Asterisk/FreePBX) for global carrier routing.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">SIP Domain / Gateway URI</label>
                <input
                  type="text"
                  className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  value={sipForm.sip_domain}
                  onChange={e => setSipForm({...sipForm, sip_domain: e.target.value})}
                  placeholder="sip.telnyx.com:5060"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">Username / Auth ID</label>
                  <input
                    type="text"
                    className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                    value={sipForm.username}
                    onChange={e => setSipForm({...sipForm, username: e.target.value})}
                    placeholder="user_or_trunk_id"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">Transport</label>
                  <select
                    className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary bg-white"
                    value={sipForm.transport}
                    onChange={e => setSipForm({...sipForm, transport: e.target.value})}
                  >
                    <option value="UDP">UDP (Standard)</option>
                    <option value="TCP">TCP</option>
                    <option value="TLS">TLS (Encrypted)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">SIP Password / Secret</label>
                <input
                  type="password"
                  className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  value={sipForm.password}
                  onChange={e => setSipForm({...sipForm, password: e.target.value})}
                  placeholder="••••••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">Outbound Caller ID (CLI)</label>
                <input
                  type="text"
                  className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  value={sipForm.outbound_number}
                  onChange={e => setSipForm({...sipForm, outbound_number: e.target.value})}
                  placeholder="+14155552671"
                />
                <p className="text-xs text-gray-500 mt-1">Carrier-assigned outbound number in E.164 format (+1... / +91...).</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowSipModal(false)}
                className="px-4 py-2 border border-[#F2DED6] hover:bg-gray-50 rounded-lg text-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitSipConnect}
                disabled={isConnecting || !sipForm.sip_domain || !sipForm.username || !sipForm.password || !sipForm.outbound_number}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 font-medium disabled:opacity-50 transition-colors shadow-sm"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Linking SIP Trunk...
                  </>
                ) : 'Connect SIP Trunk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal with Meta Cloud API and QR Code tabs */}
      {showWaModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowWaModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6" />
              <h2 className="text-xl font-bold text-gray-900">Connect WhatsApp Business</h2>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setWaMode('meta')}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  waMode === 'meta'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🚀 Meta Cloud API (Official)
              </button>
              <button
                type="button"
                onClick={() => {
                  setWaMode('qr');
                  startWaSession();
                }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  waMode === 'qr'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                📱 QR Code Web Scanner
              </button>
            </div>

            {waMode === 'meta' ? (
              <div className="space-y-3 text-left">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 leading-relaxed">
                  <strong>Official Meta Business API:</strong> Directly send high-volume campaigns without QR disconnects using your Meta System User token and Phone Number ID.
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">
                    Meta Permanent Access Token / API Key
                  </label>
                  <input
                    type="password"
                    className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                    value={waMetaForm.access_token}
                    onChange={e => setWaMetaForm({...waMetaForm, access_token: e.target.value})}
                    placeholder="EAABwzLIXnjYBO..."
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Permanent system user token from Meta Business Manager.</p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                      value={waMetaForm.phone_number_id}
                      onChange={e => setWaMetaForm({...waMetaForm, phone_number_id: e.target.value})}
                      placeholder="100609346426371"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">
                      WABA Account ID (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                      value={waMetaForm.waba_id}
                      onChange={e => setWaMetaForm({...waMetaForm, waba_id: e.target.value})}
                      placeholder="100609346426300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-700">
                    Sender Phone Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-[#F2DED6] rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                    value={waMetaForm.from_phone_number}
                    onChange={e => setWaMetaForm({...waMetaForm, from_phone_number: e.target.value})}
                    placeholder="+919876543210 or +1234567890"
                  />
                </div>

                <div className="pt-3 flex gap-2.5 justify-end">
                  <button
                    onClick={() => setShowWaModal(false)}
                    className="px-4 py-2 border border-[#F2DED6] hover:bg-gray-50 rounded-lg text-gray-600 font-medium text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitWaMetaConnect}
                    disabled={isConnecting || !waMetaForm.access_token || !waMetaForm.phone_number_id || !waMetaForm.from_phone_number}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-1.5 font-medium text-xs disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Verifying Meta API...
                      </>
                    ) : 'Connect Meta API'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-4">Scan the QR code below with your WhatsApp mobile app to pair via web session.</p>
                
                <div className="min-h-[190px] flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl mb-4">
                  {isWaLoading ? (
                    <div className="flex flex-col items-center text-gray-400 text-xs">
                      <Loader2 className="w-7 h-7 animate-spin mb-2 text-primary" />
                      Generating QR Code...
                    </div>
                  ) : waQrData?.qr_code ? (
                    <img src={waQrData.qr_code} alt="WhatsApp QR Code" className="max-w-[180px] max-h-[180px]" />
                  ) : (
                    <div className="text-gray-400 text-xs">
                      <p>Check terminal logs if QR doesn't appear.</p>
                      <button
                        onClick={startWaSession}
                        className="mt-2 text-primary font-semibold hover:underline"
                      >
                        Reload QR Code
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowWaModal(false)} className="px-4 py-2 border border-[#F2DED6] hover:bg-gray-50 rounded-lg text-gray-600 font-medium text-xs transition-colors w-full">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Configuration & Diagnostic Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <button 
              onClick={() => {
                setShowConfigModal(null);
                setTestResult(null);
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Configure {integrations.find(i => i.id === showConfigModal)?.name}
              </h2>
              
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-[#FAF9F6] border border-[#F2DED6] rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connected Account</p>
                    <p className="text-sm text-gray-800 font-medium font-mono mt-1 truncate max-w-[200px]">
                      {user?.integrations?.[showConfigModal]?.email || user?.integrations?.[showConfigModal]?.outbound_number || user?.integrations?.[showConfigModal]?.from_number || (showConfigModal === 'whatsapp' ? 'WhatsApp Paired' : 'Connected')}
                    </p>
                  </div>
                  <span className="flex items-center text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full border border-green-200">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active
                  </span>
                </div>

                {showConfigModal === 'twilio' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#F2DED6] rounded-xl text-sm text-gray-700 space-y-2 font-mono">
                    <p><span className="font-semibold">Account SID:</span> {user?.integrations?.twilio?.account_sid}</p>
                    <p><span className="font-semibold">From Number:</span> {user?.integrations?.twilio?.from_number}</p>
                  </div>
                )}

                {showConfigModal === 'vobiz' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#F2DED6] rounded-xl text-sm text-gray-700 space-y-2 font-mono">
                    <p><span className="font-semibold">SIP Domain:</span> {user?.integrations?.vobiz?.sip_domain}</p>
                    <p><span className="font-semibold">Username:</span> {user?.integrations?.vobiz?.username}</p>
                    <p><span className="font-semibold">Caller ID (DID):</span> {user?.integrations?.vobiz?.outbound_number}</p>
                    {user?.integrations?.vobiz?.sip_trunk_id && (
                      <p><span className="font-semibold text-xs text-primary">LiveKit Trunk: {user?.integrations?.vobiz?.sip_trunk_id}</span></p>
                    )}
                  </div>
                )}

                {showConfigModal === 'sip' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#F2DED6] rounded-xl text-sm text-gray-700 space-y-2 font-mono">
                    <p><span className="font-semibold">SIP Domain:</span> {user?.integrations?.sip?.sip_domain}</p>
                    <p><span className="font-semibold">Username:</span> {user?.integrations?.sip?.username}</p>
                    <p><span className="font-semibold">Caller ID (DID):</span> {user?.integrations?.sip?.outbound_number}</p>
                    <p><span className="font-semibold">Transport:</span> {user?.integrations?.sip?.transport || 'UDP'}</p>
                    {user?.integrations?.sip?.sip_trunk_id && (
                      <p><span className="font-semibold text-xs text-primary">LiveKit Trunk: {user?.integrations?.sip?.sip_trunk_id}</span></p>
                    )}
                  </div>
                )}

                {showConfigModal === 'whatsapp' && (
                  <div className="p-4 bg-[#FAF9F6] border border-[#F2DED6] rounded-xl text-sm text-gray-700 space-y-2 font-mono">
                    <p>
                      <span className="font-semibold">Integration Type:</span>{' '}
                      <span className="text-emerald-700 font-bold">
                        {user?.integrations?.whatsapp?.provider_type === 'meta' || user?.integrations?.whatsapp?.access_token
                          ? 'Official Meta Cloud API'
                          : 'Web Session (OpenWA)'}
                      </span>
                    </p>
                    {user?.integrations?.whatsapp?.phone_number_id && (
                      <p><span className="font-semibold">Phone Number ID:</span> {user?.integrations?.whatsapp?.phone_number_id}</p>
                    )}
                    {user?.integrations?.whatsapp?.waba_id && (
                      <p><span className="font-semibold">WABA ID:</span> {user?.integrations?.whatsapp?.waba_id}</p>
                    )}
                    {user?.integrations?.whatsapp?.from_phone_number && (
                      <p><span className="font-semibold">Sender Phone:</span> {user?.integrations?.whatsapp?.from_phone_number}</p>
                    )}
                    {user?.integrations?.whatsapp?.verified_name && (
                      <p><span className="font-semibold">Display Name:</span> {user?.integrations?.whatsapp?.verified_name}</p>
                    )}
                  </div>
                )}

                {/* Live Test Connection Card */}
                <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Health & Delivery Test</p>
                      <p className="text-xs text-gray-500">Verify your credentials and connection with provider.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTestConnection(showConfigModal)}
                      disabled={isTestingConnection}
                      className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isTestingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Test Live
                    </button>
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                      testResult.success 
                        ? 'bg-green-50 text-green-800 border-green-200' 
                        : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 leading-relaxed">
                        <span className="font-semibold">{testResult.success ? 'Verified:' : 'Error:'}</span> {testResult.message}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                {showConfigModal === 'twilio' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTwilioForm({
                        account_sid: user?.integrations?.twilio?.account_sid || '',
                        auth_token: user?.integrations?.twilio?.auth_token || '',
                        from_number: user?.integrations?.twilio?.from_number || ''
                      });
                      setShowConfigModal(null);
                      setShowTwilioModal(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mr-auto"
                  >
                    Edit Credentials
                  </button>
                )}
                {showConfigModal === 'vobiz' && (
                  <button
                    type="button"
                    onClick={() => {
                      setVobizForm({
                        sip_domain: user?.integrations?.vobiz?.sip_domain || '',
                        username: user?.integrations?.vobiz?.username || '',
                        password: user?.integrations?.vobiz?.password || '',
                        outbound_number: user?.integrations?.vobiz?.outbound_number || ''
                      });
                      setShowConfigModal(null);
                      setShowVobizModal(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mr-auto"
                  >
                    Edit Credentials
                  </button>
                )}
                {showConfigModal === 'whatsapp' && (
                  <button
                    type="button"
                    onClick={() => {
                      setWaMode('meta');
                      setWaMetaForm({
                        access_token: user?.integrations?.whatsapp?.access_token || '',
                        phone_number_id: user?.integrations?.whatsapp?.phone_number_id || '',
                        waba_id: user?.integrations?.whatsapp?.waba_id || '',
                        from_phone_number: user?.integrations?.whatsapp?.from_phone_number || ''
                      });
                      setShowConfigModal(null);
                      setShowWaModal(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mr-auto"
                  >
                    Edit Meta Credentials
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowConfigModal(null);
                    setTestResult(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDisconnect(showConfigModal)}
                  disabled={isDisconnecting}
                  className="flex items-center px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
