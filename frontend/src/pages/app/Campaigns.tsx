import { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, Search, Calendar, PhoneCall, Mail, Share2, MessageCircle, X, Loader2, Image as ImageIcon, Send, Upload, Save, ChevronDown, ChevronRight, Mic, Sparkles, Trash2, ShieldCheck, AlertCircle, CheckCircle2, Info, Volume2, Play, PhoneOutgoing, Radio, RotateCcw, Copy, Eye, Check, ExternalLink, FileText } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { getDisplayEmail } from './Leads';


export default function Campaigns() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('linkedin');
  const [objective, setObjective] = useState('engagement');
  const [action, setAction] = useState('post');
  const [productName, setProductName] = useState('');
  const [targetCustomer, setTargetCustomer] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [productInfo, setProductInfo] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [imageOption, setImageOption] = useState<'none' | 'upload' | 'generate'>('none');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [campaignsList, setCampaignsList] = useState<any[]>([]);

  // View Campaign State
  const [viewingCampaign, setViewingCampaign] = useState<any>(null);
  const [industryGroups, setIndustryGroups] = useState<any[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());
  const [selectedLeadEmails, setSelectedLeadEmails] = useState<Set<string>>(new Set());
  const [expandedIndustries, setExpandedIndustries] = useState<Set<string>>(new Set());
  const [onlyVerifiedEmails, setOnlyVerifiedEmails] = useState(false);

  // Voice Campaign State
  const [voiceRawPrompt, setVoiceRawPrompt] = useState('');
  const [voiceRefinedPrompt, setVoiceRefinedPrompt] = useState('');
  const [voiceFirstMessage, setVoiceFirstMessage] = useState('अरे हेलो भाई! हाहा, मैं नरेश बोल रहा हूँ... और सुना यार, क्या हाल-चाल तेरे?');
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const [sendFollowupSms, setSendFollowupSms] = useState(true);
  const [selectedLeadPhones, setSelectedLeadPhones] = useState<Set<string>>(new Set());
  // Voice Accent & Language State (Defaults to Hindi with Cartesia Sonic-3 Voice 39d518b7-fd0b-4676-9b8b-29d64ff31e12 @ 0.85x speed)
  const [voiceLanguage, setVoiceLanguage] = useState<'auto' | 'hi' | 'en'>('hi');
  const [voiceAccent, setVoiceAccent] = useState<'auto' | 'in' | 'us'>('in');
  const [voiceTelephonyProvider, setVoiceTelephonyProvider] = useState<'auto' | 'vobiz' | 'twilio' | 'sip'>('auto');
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isTestCalling, setIsTestCalling] = useState(false);
  const [testCallFeedback, setTestCallFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPlayingCartesiaAudio, setIsPlayingCartesiaAudio] = useState(false);
  const [testCustomText, setTestCustomText] = useState('');
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [hasCopiedContent, setHasCopiedContent] = useState(false);

  // Integration-aware safety helpers
  const connectedEmail = user?.integrations?.gmail?.email || user?.integrations?.smtp?.email || null;
  const isPersonalGmail = connectedEmail ? connectedEmail.toLowerCase().endsWith('@gmail.com') : false;
  const isEmailConnected = !!(user?.integrations?.gmail || user?.integrations?.smtp);

  const renderDeliverabilityAdvisor = (channel: string, count: number) => {
    if (channel === 'email') {
      if (!isEmailConnected) {
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2.5 mt-3 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">No Email Integration Detected</p>
              <p className="mt-0.5 text-amber-700">
                You have not connected an email account yet. Please connect Google Workspace or SMTP in{' '}
                <a href="/app/integrations" className="underline font-semibold text-amber-900 hover:text-amber-950">Integrations</a> before publishing.
              </p>
            </div>
          </div>
        );
      }

      if (isPersonalGmail) {
        const isOverLimit = count > 50;
        return (
          <div className={`rounded-lg p-3 text-xs border flex items-start gap-2.5 mt-3 mb-4 ${
            isOverLimit ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {isOverLimit ? <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /> : <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">Personal Gmail Sender:</span>
                <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-gray-200">{connectedEmail}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isOverLimit ? 'bg-red-200 text-red-900' : 'bg-blue-200 text-blue-900'
                }`}>
                  {count} / 50 Daily Safe Cap
                </span>
              </div>
              <p className="mt-1 text-gray-700 leading-relaxed">
                {isOverLimit ? (
                  <span className="text-red-700 font-medium">
                    ⚠️ <strong>Spam Penalty Risk:</strong> You selected {count} recipients. Google's automated spam filters frequently restrict personal @gmail.com accounts sending &gt;50 cold emails per day. We strongly suggest capping this batch at ≤50 or upgrading to Google Workspace.
                  </span>
                ) : (
                  <span>
                    💡 <strong>Optimal Volume:</strong> Personal Gmail accounts perform best under 50 cold emails/day. Keep the "Only send to Verified Emails" box checked to ensure low bounce rates.
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      } else {
        // Domain / Workspace / SMTP
        const isOverLimit = count > 150;
        return (
          <div className={`rounded-lg p-3 text-xs border flex items-start gap-2.5 mt-3 mb-4 ${
            isOverLimit ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {isOverLimit ? <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">Custom Domain / Workspace:</span>
                <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-gray-200">{connectedEmail || "Configured"}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isOverLimit ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {count} / 150 Recommended
                </span>
              </div>
              <p className="mt-1 text-gray-700 leading-relaxed">
                {isOverLimit ? (
                  <span className="text-amber-800 font-medium">
                    ⚠️ <strong>Deliverability Advisory:</strong> You selected {count} recipients. To maintain pristine sender reputation and avoid landing in spam/junk folders, the industry standard cap is 100–150 cold emails per day per inbox.
                  </span>
                ) : (
                  <span>
                    ✅ <strong>Safe Outreach Pace:</strong> {count} emails is within the healthy threshold for single-inbox outreach. Always maintain SPF, DKIM, and DMARC on your domain.
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      }
    }

    if (channel === 'whatsapp') {
      const isHighRisk = count > 250;
      const isModerate = count > 150 && count <= 250;

      return (
        <div className={`rounded-lg p-3 text-xs border flex items-start gap-2.5 mt-3 mb-4 ${
          isHighRisk ? 'bg-red-50 border-red-200 text-red-800' : isModerate ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {isHighRisk ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          ) : isModerate ? (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">WhatsApp Anti-Ban Protection:</span>
              <span className="bg-white px-2 py-0.5 rounded border border-gray-200 font-mono text-[11px] text-gray-700">4-7s Safe Jitter</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isHighRisk ? 'bg-red-200 text-red-900' : isModerate ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {count} / 200 Daily Target
              </span>
            </div>
            <p className="mt-1 text-gray-700 leading-relaxed">
              {isHighRisk ? (
                <span className="text-red-700 font-medium">
                  🚨 <strong>High Suspension Risk:</strong> Sending &gt;250 messages to unsaved numbers in 24 hours has a high probability of temporary WhatsApp bans. We strongly advise splitting this campaign into smaller daily batches.
                </span>
              ) : isModerate ? (
                <span className="text-amber-800 font-medium">
                  ⚠️ <strong>Moderate Volume ({count} contacts):</strong> Safe for established numbers (&gt;1 month old with regular 2-way chat history). For fresh SIM cards (&lt;30 days old), stay below 100/day.
                </span>
              ) : (
                <span>
                  ✅ <strong>Safe Volume ({count} contacts):</strong> Within the safe threshold for automated outreach. Anti-ban safe jitter (4.0s–7.5s delays) and batch cooldowns will execute automatically in the background.
                </span>
              )}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const fetchCampaigns = async () => {
    try {
      const userId = user?.user_id || 'user_12345_john_doe';
      const data = await apiFetch(`/api/campaigns/?user_id=${userId}`);
      if (Array.isArray(data)) {
        const mappedData = data.map((c: any) => ({
          ...c,
          icon: c.type === 'LinkedIn' ? Share2 : c.type === 'Voice' ? PhoneCall : (c.type === 'SMS' || c.type === 'WhatsApp') ? MessageCircle : Mail
        }));
        setCampaignsList(mappedData);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await apiFetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      });
      fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting campaign');
    }
  };

  const handleReuseCampaign = (campaign: any) => {
    if (!campaign) return;

    // Close view modal
    setViewingCampaign(null);

    // Channel type
    const rawType = (campaign.type || 'email').toLowerCase();
    const type = (rawType === 'call' || rawType === 'voice') ? 'voice' : rawType;
    setCampaignType(type);

    // Name
    const baseName = campaign.name || 'Campaign';
    setCampaignName(baseName.startsWith('Copy of ') ? baseName : `Copy of ${baseName}`);

    // Marketing fields with solid fallbacks so NO FIELD IS EVER MISSING OR EMPTY
    setObjective(campaign.objective || 'engagement');
    setAction(campaign.action || 'post');
    setProductName(campaign.product_name || campaign.name || 'ANVR-GTM Outreach');
    setTargetCustomer(campaign.target_customer || 'CTOs, Enterprise Founders & Decision Makers');
    setCallToAction(campaign.call_to_action || (type === 'voice' ? 'Schedule a 15-minute introductory call' : 'Book a demo / Reply to this message'));

    const contentText = campaign.content || campaign.prompt || '';
    setProductInfo(campaign.product_info || contentText || `${campaign.name || 'Campaign'} details and outreach objectives.`);

    // Content and image
    setGeneratedContent(contentText);
    if (campaign.image_url) {
      setImageUrl(campaign.image_url);
      setImageOption('upload');
    } else {
      setImageUrl('');
      setImageOption('none');
    }

    // Voice specific
    if (type === 'voice') {
      const p = campaign.prompt || campaign.content || '';
      setVoiceRawPrompt(p);
      setVoiceRefinedPrompt(p);
      setVoiceFirstMessage(campaign.first_message || 'Hello! Thanks for taking my call.');
      setVoiceLanguage(campaign.language === 'en' ? 'en' : campaign.language === 'auto' ? 'auto' : 'hi');
      setVoiceAccent(campaign.accent === 'us' ? 'us' : campaign.accent === 'auto' ? 'auto' : 'in');
    }

    // Restore selected audience/leads
    const audienceList = campaign.audience || campaign.leads || [];
    if (Array.isArray(audienceList) && audienceList.length > 0) {
      if (['voice', 'sms', 'whatsapp'].includes(type)) {
        const phones = new Set<string>();
        audienceList.forEach((a: any) => {
          const ph = a.contact || a.phone;
          if (ph) phones.add(ph);
        });
        setSelectedLeadPhones(phones);
      } else {
        const emails = new Set<string>();
        audienceList.forEach((a: any) => {
          const em = a.contact || a.email;
          if (em) emails.add(em);
        });
        setSelectedLeadEmails(emails);
      }
    }

    // Open create modal
    setShowCreateModal(true);
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Poll continuously while any campaign is actively Sending in the background
  useEffect(() => {
    const hasSending = campaignsList.some(c => c.status === 'Sending');
    if (!hasSending) return;

    const interval = setInterval(() => {
      fetchCampaigns();
    }, 3000);

    return () => clearInterval(interval);
  }, [campaignsList]);

  const displayedCampaigns = campaignsList.filter(c => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Active') return c.status === 'Active' || c.status === 'Sending';
    if (activeTab === 'Paused') return c.status === 'Paused';
    if (activeTab === 'Drafts') return c.status === 'Draft';
    return true;
  });

  useEffect(() => {
    if (viewingCampaign) {
      const type = viewingCampaign.type?.toLowerCase();
      if (['email', 'sms', 'call', 'voice', 'whatsapp'].includes(type)) {
        fetchLeads();
      }
      if (type === 'sms' && viewingCampaign.status === 'Active') {
        fetchSmsLogs(viewingCampaign.id);
      } else {
        setSmsLogs([]);
      }
    }
  }, [viewingCampaign]);

  const fetchSmsLogs = async (campaignId: string) => {
    try {
      const data = await apiFetch(`/api/campaigns/sms/logs?campaign_id=${campaignId}`);
      if (data.status === 'success') {
        setSmsLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch SMS logs', err);
    }
  };

  useEffect(() => {
    if (showCreateModal && (campaignType === 'email' || campaignType === 'sms' || campaignType === 'whatsapp' || campaignType === 'voice')) {
      fetchLeads();
    }
  }, [showCreateModal, campaignType]);

  const fetchLeads = async () => {
    try {
      const currentUserId = user?.user_id || 'user_12345_john_doe';

      // Fetch both leads and imported contacts in parallel
      const [leadsData, contactsData] = await Promise.all([
        apiFetch(`/api/leads?user_id=${currentUserId}`),
        apiFetch(`/api/contacts`)
      ]);

      let allGroups: any[] = [];

      if (leadsData.success && leadsData.industry_groups) {
        allGroups = [...leadsData.industry_groups];
      }

      if (contactsData.success && contactsData.contact_groups) {
        const mappedContacts = contactsData.contact_groups.map((cg: any) => ({
          industry: `(CSV) ${cg.list_name}`,
          lead_count: cg.contact_count,
          leads: cg.contacts
        }));
        allGroups = [...allGroups, ...mappedContacts];
      }

      setIndustryGroups(allGroups);
    } catch (err) {
      console.error('Failed to fetch audiences:', err);
    }
  };

  const toggleIndustryExpanded = (industry: string) => {
    setExpandedIndustries(prev => {
      const next = new Set(prev);
      if (next.has(industry)) next.delete(industry);
      else next.add(industry);
      return next;
    });
  };

  const toggleLeadSelection = (email: string) => {
    setSelectedLeadEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleIndustrySelection = (industry: string, leads: any[] = []) => {
    setSelectedIndustries(prev => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(industry);

      const activeType = viewingCampaign ? viewingCampaign.type?.toLowerCase() : campaignType;
      const isSmsOrVoice = ['sms', 'voice', 'call'].includes(activeType);

      if (isSmsOrVoice) {
        setSelectedLeadPhones(prevPhones => {
          const nextPhones = new Set(prevPhones);
          if (isCurrentlySelected) {
            next.delete(industry);
            leads.filter(l => l.phone).forEach(l => nextPhones.delete(l.phone));
          } else {
            next.add(industry);
            leads.filter(l => l.phone).forEach(l => nextPhones.add(l.phone));
          }
          return nextPhones;
        });
      } else {
        setSelectedLeadEmails(prevEmails => {
          const nextEmails = new Set(prevEmails);
          if (isCurrentlySelected) {
            next.delete(industry);
            leads.filter(l => l.email).forEach(l => nextEmails.delete(l.email));
          } else {
            next.add(industry);
            leads.filter(l => l.email).forEach(l => nextEmails.add(l.email));
          }
          return nextEmails;
        });
      }
      return next;
    });
  };

  const handleGenerateContent = async () => {
    setIsGeneratingContent(true);
    try {
      const data = await apiFetch('/api/campaigns/generate-content', {
        method: 'POST',
        bodyData: {
          user_id: user?.user_id,
          channel: campaignType,
          objective: objective,
          action: action,
          product_name: productName,
          target_customer: targetCustomer,
          call_to_action: callToAction,
          product_info: productInfo
        }
      });
      setGeneratedContent(data.content);
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.scrollTo({ top: modalRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      console.error(err);
      alert('Failed to generate content');
    }
    setIsGeneratingContent(false);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    const getBackendUrl = () => {
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
      }
      if (typeof window !== 'undefined') {
        if (window.location.hostname.includes('azurestaticapps.net') || window.location.hostname.includes('green-dune')) {
          return 'https://gtm-backend1-hmgygeahadebdyc7.canadacentral-01.azurewebsites.net';
        }
      }
      return 'http://localhost:8000';
    };

    try {
      const data = await apiFetch('/api/campaigns/linkedin/upload-image', {
        method: 'POST',
        headers: {},
        body: formData
      } as any);
      setImageUrl(getBackendUrl() + data.image_url);
    } catch (err) {
      console.error(err);
      alert('Failed to upload image');
    }
    setIsUploadingImage(false);
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    const getBackendUrl = () => {
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
      }
      if (typeof window !== 'undefined') {
        if (window.location.hostname.includes('azurestaticapps.net') || window.location.hostname.includes('green-dune')) {
          return 'https://gtm-backend1-hmgygeahadebdyc7.canadacentral-01.azurewebsites.net';
        }
      }
      return 'http://localhost:8000';
    };
    try {
      const data = await apiFetch('/api/campaigns/linkedin/generate-image', {
        method: 'POST',
        bodyData: { 
          user_id: user?.user_id,
          content: generatedContent 
        }
      });
      setImageUrl(getBackendUrl() + data.image_url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate image');
    }
    setIsGeneratingImage(false);
  };

  // Voice: Refine prompt via AI
  const handleRefineVoicePrompt = async () => {
    setIsRefiningPrompt(true);
    try {
      const data = await apiFetch('/api/campaigns/voice/refine-prompt', {
        method: 'POST',
        bodyData: {
          user_id: user?.user_id || 'user_12345_john_doe',
          raw_prompt: voiceRawPrompt,
          product_name: productName,
          target_customer: targetCustomer,
          call_to_action: callToAction,
        }
      });
      if (data.status === 'success') {
        setVoiceRefinedPrompt(data.refined_prompt);
      } else {
        alert(data.message || 'Failed to refine prompt');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to refine voice prompt');
    }
    setIsRefiningPrompt(false);
  };

  // Voice: toggle phone selection
  const toggleLeadPhoneSelection = (phone: string) => {
    setSelectedLeadPhones(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  // Voice: toggle all phones in industry
  const toggleIndustryPhoneSelection = (_industry: string, leads: any[]) => {
    const phonesInGroup = (leads || []).filter((l: any) => l.phone).map((l: any) => l.phone);
    setSelectedLeadPhones(prev => {
      const next = new Set(prev);
      const allSelected = phonesInGroup.every((p: string) => next.has(p));
      if (allSelected) {
        phonesInGroup.forEach((p: string) => next.delete(p));
      } else {
        phonesInGroup.forEach((p: string) => next.add(p));
      }
      return next;
    });
  };

  // Voice: Dispatch direct test call to user's phone via LiveKit
  const handleTestCall = async () => {
    if (!testPhoneNumber.trim()) {
      alert("Please enter a phone number with country code (e.g. +91 9876543210) to test.");
      return;
    }
    setIsTestCalling(true);
    setTestCallFeedback(null);
    try {
      const data = await apiFetch('/api/campaigns/voice/test-call', {
        method: 'POST',
        bodyData: {
          user_id: user?.user_id || 'user_12345_john_doe',
          phone: testPhoneNumber.trim(),
          prompt: voiceRefinedPrompt || voiceRawPrompt || 'You are an AI sales assistant. Introduce yourself politely and ask how you can help.',
          first_message: voiceFirstMessage,
          language: voiceLanguage,
          accent: voiceAccent,
          telephony_provider: voiceTelephonyProvider,
        }
      });
      if (data.status === 'success') {
        setTestCallFeedback({
          type: 'success',
          message: data.message || `Dialing ${testPhoneNumber} now. Pick up your phone!`
        });
      } else {
        setTestCallFeedback({
          type: 'error',
          message: data.message || 'Failed to dispatch test call.'
        });
      }
    } catch (err: any) {
      setTestCallFeedback({
        type: 'error',
        message: err.message || 'Call dispatch failed. Ensure LiveKit/Vobiz credentials are set.'
      });
    } finally {
      setIsTestCalling(false);
    }
  };

  // Voice: Synthesize and play real Cartesia AI voice audio directly in the browser
  const handlePlayCartesiaVoice = async (textToSpeak?: string, langOverride?: string) => {
    const activeLang = (langOverride || voiceLanguage || 'hi').toLowerCase();
    const isHindi = activeLang === 'hi';
    const text = (textToSpeak || testCustomText || voiceFirstMessage || (isHindi ? 'अरे हेलो यार! मैं नरेश। बोल, क्या हाल-चाल?' : 'Hello! Thanks for taking my call.')).trim();
    
    // Toggle play / pause if clicked while playing
    if (audioPlayerRef.current && isPlayingCartesiaAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingCartesiaAudio(false);
      return;
    }

    setIsPlayingCartesiaAudio(true);
    try {
      const getBackendUrl = () => {
        if (import.meta.env.VITE_API_URL) {
          return import.meta.env.VITE_API_URL;
        }
        if (typeof window !== 'undefined') {
          if (window.location.hostname.includes('azurestaticapps.net') || window.location.hostname.includes('green-dune')) {
            return 'https://gtm-backend1-hmgygeahadebdyc7.canadacentral-01.azurewebsites.net';
          }
        }
        return 'http://localhost:8000';
      };

      const response = await fetch(`${getBackendUrl()}/api/campaigns/voice/preview-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: isHindi ? 'hi' : 'en',
          voice_id: isHindi ? '39d518b7-fd0b-4676-9b8b-29d64ff31e12' : '248be419-c632-4f23-add1-07c49495163f',
          speed: isHindi ? 0.85 : 1.0,
        })
      });

      if (!response.ok) {
        throw new Error('TTS voice generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.onended = () => setIsPlayingCartesiaAudio(false);
        audioPlayerRef.current.onerror = () => setIsPlayingCartesiaAudio(false);
        audioPlayerRef.current.play();
      } else {
        const audio = new Audio(url);
        audioPlayerRef.current = audio;
        audio.onended = () => setIsPlayingCartesiaAudio(false);
        audio.onerror = () => setIsPlayingCartesiaAudio(false);
        audio.play();
      }
    } catch (err: any) {
      console.error('Audio preview error:', err);
      alert('Could not synthesize voice: ' + err.message);
      setIsPlayingCartesiaAudio(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (campaignType === 'voice') {
        // Voice campaign publish
        let collectedLeads: any[] = [];
        industryGroups.forEach((g: any) => {
          (g.leads || []).forEach((l: any) => {
            if (selectedLeadPhones.has(l.phone)) {
              collectedLeads.push({ name: l.name, phone: l.phone });
            }
          });
        });

        const data = await apiFetch('/api/campaigns/voice/publish', {
          method: 'POST',
          bodyData: {
            user_id: user?.user_id || 'user_12345_john_doe',
            name: campaignName || productName || 'Voice Campaign',
            prompt: voiceRefinedPrompt || voiceRawPrompt,
            first_message: voiceFirstMessage,
            language: voiceLanguage,
            accent: voiceAccent,
            telephony_provider: voiceTelephonyProvider,
            leads: collectedLeads,
            send_followup_sms: sendFollowupSms,
          }
        });
        alert(data.message);
      } else if (campaignType === 'sms' || campaignType === 'whatsapp') {
        let collectedLeads: any[] = [];
        industryGroups.forEach(g => {
          (g.leads || []).forEach((l: any) => {
            if (l.phone && selectedLeadPhones.has(l.phone)) {
              collectedLeads.push(l);
            }
          });
        });

        const isWhatsApp = campaignType === 'whatsapp';
        const endpoint = isWhatsApp ? '/api/campaigns/whatsapp/publish' : '/api/campaigns/sms/publish';
        const defaultName = isWhatsApp ? "WhatsApp Campaign" : "SMS Campaign";

        const data = await apiFetch(endpoint, {
          method: 'POST',
          bodyData: {
            action,
            content: generatedContent,
            image_url: imageUrl,
            user_id: user?.user_id || "user_12345_john_doe",
            name: campaignName || productName || defaultName,
            method: "leads",
            leads: collectedLeads.map(l => ({ name: l.name, phone: l.phone }))
          }
        });
        if (data.status === 'error') {
          if (!isWhatsApp && data.message && data.message.includes('Twilio')) {
            if (window.confirm(data.message + "\n\nWould you like to go to the Integrations page to connect it now?")) {
              window.location.href = '/app/integrations';
              return;
            }
          } else if (isWhatsApp && data.message && data.message.toLowerCase().includes('whatsapp')) {
            if (window.confirm(data.message + "\n\nWould you like to go to the Integrations page to verify your WhatsApp connection?")) {
              window.location.href = '/app/integrations';
              return;
            }
          } else {
            alert("Error: " + data.message);
          }
          setIsPublishing(false);
          return;
        } else {
          alert(data.message);
        }
      } else if (campaignType === 'email') {
        let collectedLeads: any[] = [];
        industryGroups.forEach(g => {
          (g.leads || []).forEach((l: any) => {
            if (l.email && selectedLeadEmails.has(l.email)) {
              if (!onlyVerifiedEmails || l.is_verified) {
                collectedLeads.push(l);
              }
            }
          });
        });

        const data = await apiFetch('/api/campaigns/email/publish', {
          method: 'POST',
          bodyData: {
            action,
            content: generatedContent,
            image_url: imageUrl,
            user_id: user?.user_id || "user_12345_john_doe",
            name: campaignName || productName || "EMAIL Campaign",
            method: "leads",
            leads: collectedLeads.map(l => ({ name: l.name, email: l.email, phone: l.phone }))
          }
        });
        if (data.status === 'error') {
          alert("Error: " + data.message);
          setIsPublishing(false);
          return;
        } else {
          alert(data.message);
        }
      } else {
        const data = await apiFetch('/api/campaigns/linkedin/publish', {
          method: 'POST',
          bodyData: {
            action,
            content: generatedContent,
            image_url: imageUrl,
            user_id: user?.user_id || "user_12345_john_doe",
            name: campaignName || productName || "LinkedIn Campaign"
          }
        });
        alert(data.message);
      }

      setShowCreateModal(false);
      setGeneratedContent('');
      setImageUrl('');
      setCampaignName('');
      setProductName('');
      setTargetCustomer('');
      setCallToAction('');
      setProductInfo('');
      setImageOption('none');
      setSelectedIndustries(new Set());
      setVoiceRawPrompt('');
      setVoiceRefinedPrompt('');
      setVoiceFirstMessage('Hello! Thanks for taking my call.');
      setSelectedLeadPhones(new Set());
      fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to publish campaign');
    }
    setIsPublishing(false);
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      if (campaignType === 'voice') {
        const data = await apiFetch('/api/campaigns/voice/draft', {
          method: 'POST',
          bodyData: {
            user_id: user?.user_id || 'user_12345_john_doe',
            name: campaignName || productName || 'Untitled Voice Campaign',
            prompt: voiceRefinedPrompt || voiceRawPrompt,
            first_message: voiceFirstMessage,
            leads: [],
          }
        });
        alert(data.message);
      } else {
        const data = await apiFetch('/api/campaigns/linkedin/draft', {
          method: 'POST',
          bodyData: {
            action,
            content: generatedContent,
            image_url: imageUrl,
            user_id: user?.user_id || "user_12345_john_doe",
            name: campaignName || productName || "Untitled Campaign"
          }
        });
        alert(data.message);
      }
      setShowCreateModal(false);
      setGeneratedContent('');
      setImageUrl('');
      setCampaignName('');
      setProductName('');
      setTargetCustomer('');
      setCallToAction('');
      setProductInfo('');
      setImageOption('none');
      setVoiceRawPrompt('');
      setVoiceRefinedPrompt('');
      setVoiceFirstMessage('Hello! Thanks for taking my call.');
      setSelectedLeadPhones(new Set());
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      alert('Failed to save draft');
    }
    setIsSavingDraft(false);
  };

  // Calculate real live metrics dynamically from the user's campaigns
  const activeCount = campaignsList.filter(c => c.status === 'Active' || c.status === 'Sending').length;
  const totalProspectsCount = campaignsList.reduce((acc, c) => acc + (c.sent || c.total_leads || (c.audience?.length) || 0), 0);
  const totalSentCount = campaignsList.reduce((acc, c) => acc + (c.sent || 0), 0);
  const totalRepliedCount = campaignsList.reduce((acc, c) => acc + (c.replied || 0), 0);
  const totalBookedCount = campaignsList.reduce((acc, c) => acc + (c.booked || 0), 0);
  const responseRate = totalSentCount > 0 ? `${((totalRepliedCount / totalSentCount) * 100).toFixed(1)}%` : '0%';

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Campaigns</h1>
          <p className="text-sm text-gray-500">Manage and monitor your automated multi-channel outreach.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      {/* Real Live Dynamic Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Campaigns', value: activeCount.toString(), sub: `${campaignsList.length} total campaigns` },
          { label: 'Total Prospects Reached', value: totalProspectsCount.toLocaleString(), sub: 'Across all campaigns' },
          { label: 'Response / Reply Rate', value: responseRate, sub: `${totalRepliedCount} replies received` },
          { label: 'Meetings Booked', value: totalBookedCount.toLocaleString(), sub: 'Confirmed positive outcomes' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-[#F2DED6] shadow-xs">
            <p className="text-xs text-gray-500 mb-1 font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex bg-white border border-[#F2DED6] rounded-lg p-1 shadow-sm">
          {['All', 'Active', 'Paused', 'Drafts'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab
                ? 'bg-[#FDF8F5] text-primary shadow-sm border border-[#F2DED6]'
                : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            className="w-full bg-white border border-[#F2DED6] rounded-lg py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Campaign List */}
      <div className="grid grid-cols-1 gap-4">
        {displayedCampaigns.map((campaign, idx) => (
          <div
            key={campaign.id || idx}
            className="bg-white hover:bg-gray-50 rounded-xl p-5 border border-[#F2DED6] shadow-sm flex flex-col md:flex-row items-center gap-6 transition-colors cursor-pointer"
            onClick={() => setViewingCampaign(campaign)}
          >
            {/* Info */}
            <div className="flex items-center gap-4 flex-1 w-full">
              <div className="w-12 h-12 rounded-xl bg-[#FDF8F5] border border-[#F2DED6] flex items-center justify-center shrink-0">
                <campaign.icon className="w-6 h-6 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{campaign.name}</h3>
                  {campaign.type === 'WhatsApp' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Anti-Ban Paced
                    </span>
                  )}
                  {campaign.type === 'Voice' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#FAF8F5] text-primary border border-[#F2DED6] px-2 py-0.5 rounded-full">
                      {campaign.language === 'hi' ? '🇮🇳 Hindi (Cartesia 0.85x)' : '🇺🇸 US English (Cartesia)'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap mb-1.5">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {campaign.date}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  <span>{campaign.type} Campaign</span>
                  {campaign.audience && campaign.audience.length > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span className="text-gray-600 font-medium">{campaign.audience.length} Contacts</span>
                    </>
                  )}
                  {campaign.status === 'Sending' && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                      <span className="text-blue-600 font-medium flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" /> In Progress (Background)
                      </span>
                    </>
                  )}
                </div>
                {/* Reusable Content Preview */}
                {(campaign.prompt || campaign.content || campaign.first_message) && (
                  <p className="text-xs text-gray-500 truncate max-w-xl italic bg-gray-50/80 px-2.5 py-1 rounded border border-gray-100">
                    "{campaign.first_message || campaign.prompt || campaign.content}"
                  </p>
                )}
              </div>
            </div>

            {/* Status & Progress */}
            <div className="w-full md:w-56">
              <div className="flex justify-between items-end mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  campaign.status === 'Sending'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 font-semibold animate-pulse'
                    : campaign.status === 'Active' || campaign.status === 'Completed'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : campaign.status === 'Paused'
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {campaign.status === 'Sending' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Sending ({campaign.sent}/{campaign.total || (campaign.audience?.length) || '...'})
                    </>
                  ) : (
                    campaign.status
                  )}
                </span>
                <span className="text-xs text-gray-500 font-medium">{campaign.progress || 0}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    campaign.status === 'Sending'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 animate-pulse'
                      : campaign.status === 'Active' || campaign.status === 'Completed'
                        ? 'bg-primary'
                        : 'bg-gray-400'
                  }`}
                  style={{ width: `${Math.max(campaign.progress || 0, campaign.status === 'Sending' ? 8 : 0)}%` }}
                ></div>
              </div>
              {campaign.dispatch_status && (
                <p className="text-[11px] text-gray-500 mt-1 truncate max-w-full font-mono" title={campaign.dispatch_status}>
                  {campaign.dispatch_status}
                </p>
              )}
            </div>

            {/* Metrics */}
            <div className="flex gap-6 w-full md:w-auto">
              <div>
                <p className="text-xs text-gray-500 mb-1">Sent</p>
                <p className="text-sm font-semibold text-gray-900">{campaign.sent}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Replied</p>
                <p className="text-sm font-semibold text-gray-900">{campaign.replied}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Meetings</p>
                <p className="text-sm font-semibold text-gray-900">{campaign.booked}</p>
              </div>
            </div>

            {/* Actions: Reuse, View, Delete */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); handleReuseCampaign(campaign); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F2DED6] text-primary border border-[#F2DED6] rounded-lg text-xs font-semibold shadow-xs transition-all hover:scale-[1.02]"
                title="Reuse and edit this campaign"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reuse</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setViewingCampaign(campaign); }}
                className="p-2 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 shadow-xs"
                title="View full content, prompt & audience"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); deleteCampaign(campaign.id); }}
                className="p-2 text-red-400 hover:text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border border-gray-200 shadow-xs"
                title="Delete Campaign"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div ref={modalRef} className={`bg-white rounded-xl ${campaignType === 'voice' ? 'max-w-5xl' : 'max-w-2xl'} w-full max-h-[90vh] flex flex-col overflow-hidden transition-all duration-200`}>
            <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {campaignType === 'voice' ? 'Create Voice Call Campaign' : `Create ${campaignType.charAt(0).toUpperCase() + campaignType.slice(1)} Campaign`}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {(generatedContent || voiceRefinedPrompt) && (
                <div className="bg-[#FAF8F5] border border-[#F2DED6] rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Loaded Reusable Campaign Template</p>
                      <p className="text-[11px] text-gray-600">All fields, audience, and message content have been restored. You can edit them or publish immediately.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2.5 py-1 rounded-full shrink-0">
                    Template Loaded
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Channel</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value)}
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="voice">Voice Call</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Objective</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  >
                    <option value="engagement">Engagement & Nurturing</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="product_launch">Product Launch</option>
                    <option value="event_management">Event Management</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Q3 Tech Founders Outreach"
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                {campaignType === 'linkedin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn Action Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="action"
                          value="post"
                          checked={action === 'post'}
                          onChange={() => setAction('post')}
                        />
                        <span>Create a Post</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="action"
                          value="dm"
                          checked={action === 'dm'}
                          onChange={() => setAction('dm')}
                        />
                        <span>Send Direct Message</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product/Service Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Genquantaa AI Agent"
                      className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Customer</label>
                    <input
                      type="text"
                      placeholder="e.g., CTOs, Sales Leaders in Healthcare"
                      className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={targetCustomer}
                      onChange={(e) => setTargetCustomer(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Call to Action (Goal)</label>
                    <input
                      type="text"
                      placeholder="e.g., Book a demo, Read the blog, Reply to this message"
                      className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={callToAction}
                      onChange={(e) => setCallToAction(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Session/Product Details</label>
                    <textarea
                      placeholder="e.g., Features, benefits, what makes it special, or session agenda..."
                      className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-24"
                      value={productInfo}
                      onChange={(e) => setProductInfo(e.target.value)}
                    />
                  </div>
                </div>

                {/* Voice-specific form section (Dual Column: Left Form & Right Interactive Phone Tester) */}
                {campaignType === 'voice' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                    {/* Left Column: Script, Language/Accent & Audience Setup */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Language & Accent Selection Cards */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Radio className="w-4 h-4 text-primary" />
                            Voice Model & Language
                          </span>
                          <span className="text-[11px] text-gray-500 font-normal">Cartesia Sonic-3 Engine</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => { setVoiceLanguage('hi'); setVoiceAccent('in'); }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              voiceLanguage === 'hi'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-base font-bold">🇮🇳 Hindi</span>
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">Default</span>
                            </div>
                            <div className="text-xs font-semibold text-gray-900 mt-1">Cartesia Sonic-3</div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">39d518b7... • 0.85x speed</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setVoiceLanguage('en'); setVoiceAccent('us'); }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              voiceLanguage === 'en'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="text-base font-bold">🇺🇸 US English</div>
                            <div className="text-xs font-semibold text-gray-900 mt-1">Cartesia Sonic-3</div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">248be419... • 1.0x speed</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setVoiceLanguage('auto'); setVoiceAccent('auto'); }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              voiceLanguage === 'auto'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="text-base font-bold">🪄 Auto-Detect</div>
                            <div className="text-xs font-semibold text-gray-900 mt-1">Script & Country Code</div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">Auto Hindi or US</div>
                          </button>
                        </div>
                      </div>

                      {/* Telephony Provider & Routing Route */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <PhoneOutgoing className="w-4 h-4 text-primary" />
                            Telephony Provider & Caller ID
                          </span>
                          <span className="text-[11px] text-gray-500 font-normal">
                            Carrier Route Selection
                          </span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setVoiceTelephonyProvider('auto')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              voiceTelephonyProvider === 'auto'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-900">🌐 Smart Geo-Route</span>
                              <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">Auto</span>
                            </div>
                            <div className="text-[11px] text-gray-600 mt-1">+91 ➔ Vobiz (India)</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">Others ➔ Twilio / SIP</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setVoiceTelephonyProvider('vobiz')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              voiceTelephonyProvider === 'vobiz'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-900">🇮🇳 Vobiz Account</span>
                              {user?.integrations?.vobiz ? (
                                <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">Linked</span>
                              ) : (
                                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">Server Default</span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-600 mt-1">India Domestic DID</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                              {user?.integrations?.vobiz?.outbound_number || '+91 Default'}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setVoiceTelephonyProvider('twilio')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              voiceTelephonyProvider === 'twilio'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-900">🌍 Twilio Account</span>
                              {user?.integrations?.twilio ? (
                                <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">Linked</span>
                              ) : (
                                <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">Not Configured</span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-600 mt-1">International Caller ID</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                              {user?.integrations?.twilio?.from_number || 'Connect in Integrations'}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setVoiceTelephonyProvider('sip')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              voiceTelephonyProvider === 'sip'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-900">📞 Custom SIP</span>
                              {user?.integrations?.sip ? (
                                <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">Linked</span>
                              ) : (
                                <span className="text-[9px] bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded">BYOC</span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-600 mt-1">Carrier Trunk / PBX</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                              {user?.integrations?.sip?.outbound_number || 'Connect in Integrations'}
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Raw Prompt / Script Goal */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Mic className="w-4 h-4 text-primary" />
                            What should your AI voice agent say?
                          </span>
                          <span className="text-xs text-gray-500">Supports Hindi, Hinglish & English</span>
                        </label>
                        <textarea
                          placeholder={
                            voiceLanguage === 'hi'
                              ? "हिंदी या हिंगलिश में लिखें: 'प्रोस्पेक्ट को कॉल करो, अपना नाम नरेश बताओ, हमारे नए CRM सॉफ़्टवेयर के बारे में पूछो, और एक 10 मिनट की मीटिंग बुक करने की कोशिश करो...'"
                              : "Describe what your agent should say: 'Call the prospect, introduce yourself as Alex from Acme, ask about their current pain points with sales ops, and book a quick demo call...'"
                          }
                          className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-28 text-sm"
                          value={voiceRawPrompt}
                          onChange={(e) => setVoiceRawPrompt(e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleRefineVoicePrompt}
                        disabled={isRefiningPrompt || !voiceRawPrompt}
                        className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-sm shadow-xs"
                      >
                        {isRefiningPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isRefiningPrompt ? 'Refining Script with AI...' : 'Refine Script with AI'}
                      </button>

                      {voiceRefinedPrompt && (
                        <div className="space-y-1.5 pt-2 border-t border-gray-100">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-semibold text-gray-700">Refined AI Agent Instructions (editable)</label>
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono">Live Persona Injected</span>
                          </div>
                          <textarea
                            className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[160px] text-xs font-mono bg-gray-50 leading-relaxed"
                            value={voiceRefinedPrompt}
                            onChange={(e) => setVoiceRefinedPrompt(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Opening Line */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Message (spoken immediately on answer)</label>
                        <input
                          type="text"
                          placeholder={voiceLanguage === 'hi' ? "अरे हेलो यार! मैं नरेश। बोल, क्या हाल-चाल?" : "Hello! Thanks for taking my call."}
                          className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                          value={voiceFirstMessage}
                          onChange={(e) => setVoiceFirstMessage(e.target.value)}
                        />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                        <input
                          type="checkbox"
                          checked={sendFollowupSms}
                          onChange={(e) => setSendFollowupSms(e.target.checked)}
                          className="text-blue-600 focus:ring-blue-500 rounded"
                        />
                        <span className="text-xs font-medium text-blue-900">Send automatic follow-up SMS with summary link after each call</span>
                      </label>

                      {/* Lead Selection for Voice */}
                      <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <PhoneCall className="w-3.5 h-3.5 text-primary" />
                            Select Target Audience ({selectedLeadPhones.size} contacts selected)
                          </span>
                          <span className="text-[11px] text-gray-500 font-normal">Phone leads only</span>
                        </h3>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto bg-white p-2 border border-gray-200 rounded">
                          {industryGroups.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No leads found. Discover leads first in the Leads tab.</p>
                          ) : (
                            industryGroups.map((group: any) => (
                              <div key={group.industry} className="flex flex-col border border-gray-200 rounded overflow-hidden mb-1">
                                <div className="flex items-center p-1.5 hover:bg-gray-50 bg-white">
                                  <input
                                    type="checkbox"
                                    checked={(group.leads || []).filter((l: any) => l.phone).every((l: any) => selectedLeadPhones.has(l.phone))}
                                    onChange={() => toggleIndustryPhoneSelection(group.industry, group.leads)}
                                    className="w-3.5 h-3.5 mr-2 text-primary focus:ring-primary rounded border-gray-300 cursor-pointer"
                                  />
                                  <div
                                    className="flex justify-between flex-1 cursor-pointer"
                                    onClick={() => toggleIndustryExpanded(group.industry)}
                                  >
                                    <span className="text-xs font-medium text-gray-900 flex items-center gap-1">
                                      {expandedIndustries.has(group.industry) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      {group.industry}
                                    </span>
                                    <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                      {(group.leads || []).filter((l: any) => l.phone).length} with phone
                                    </span>
                                  </div>
                                </div>
                                {expandedIndustries.has(group.industry) && (
                                  <div className="bg-gray-50 p-1 border-t border-gray-200 pl-5 max-h-28 overflow-y-auto">
                                    {(group.leads || []).filter((l: any) => l.phone).map((lead: any, i: number) => (
                                      <label key={i} className="flex items-center p-1 hover:bg-white rounded transition-colors cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selectedLeadPhones.has(lead.phone)}
                                          onChange={() => toggleLeadPhoneSelection(lead.phone)}
                                          className="w-3 h-3 text-primary focus:ring-primary rounded border-gray-300"
                                        />
                                        <div className="flex flex-col ml-2">
                                          <span className="text-xs font-medium text-gray-800">{lead.name}</span>
                                          <span className="text-[10px] text-gray-500">{lead.phone}</span>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Launch & Draft Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={isSavingDraft || isPublishing}
                          className="w-1/3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm"
                        >
                          {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {isSavingDraft ? 'Saving...' : 'Save Draft'}
                        </button>
                        <button
                          type="button"
                          onClick={handlePublish}
                          disabled={isPublishing || isSavingDraft || selectedLeadPhones.size === 0}
                          className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors text-sm shadow-xs"
                        >
                          {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                          {isPublishing ? 'Launching Calls...' : `Launch Calls (${selectedLeadPhones.size} Leads)`}
                        </button>
                      </div>
                    </div>

                    {/* Right Column: In-Browser Voice Tester (Matching ANVR-GTM Light Theme) */}
                    <div className="lg:col-span-5 bg-[#FAF8F5] rounded-2xl p-5 flex flex-col justify-between border border-[#F2DED6] shadow-xs relative">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-[#F2DED6]">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                            </span>
                            <span className="text-xs font-bold text-gray-900">Voice Model Tester</span>
                          </div>
                          <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-semibold">
                            Cartesia Sonic-3
                          </span>
                        </div>

                        {/* Model Configuration Card */}
                        <div className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-xs space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Voice Provider:</span>
                            <span className="font-semibold text-gray-900">Cartesia (Ultra-fast)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Voice ID:</span>
                            <span className="font-mono text-gray-800 text-[11px] bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                              {voiceLanguage === 'hi' ? '39d518b7-fd0b-4676-9b8b-29d64ff31e12' : '248be419-c632-4f23-add1-07c49495163f'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Cadence Speed:</span>
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                              {voiceLanguage === 'hi' ? '0.85x (15% slower for natural Hindi)' : '1.0x (Standard)'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">STT Model:</span>
                            <span className="text-gray-700 font-medium">Deepgram Nova-2 ({voiceLanguage === 'hi' ? 'hi' : 'en'})</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500">Carrier Route:</span>
                            <span className="font-semibold text-primary font-mono text-[11px]">
                              {voiceTelephonyProvider === 'vobiz' ? '🇮🇳 Vobiz SIP (+91)' : voiceTelephonyProvider === 'twilio' ? '🌍 Twilio Intl' : '🌐 Auto Smart Route'}
                            </span>
                          </div>
                        </div>

                        {/* In-Browser Interactive Speech Player (No phone call needed) */}
                        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                              <Volume2 className="w-3.5 h-3.5 text-primary" />
                              Test Voice Output (Browser Audio)
                            </span>
                            {isPlayingCartesiaAudio && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                                🔊 Speaking...
                              </span>
                            )}
                          </div>

                          {/* Editable Text to speak */}
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">Text to speak & test right here:</label>
                            <textarea
                              rows={3}
                              className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 resize-none font-sans"
                              placeholder="Enter any text to hear the exact voice..."
                              value={testCustomText !== '' ? testCustomText : (voiceFirstMessage || (voiceLanguage === 'hi' ? 'अरे हेलो यार! मैं नरेश। बोल, क्या हाल-चाल?' : 'Hello! Thanks for taking my call.'))}
                              onChange={(e) => setTestCustomText(e.target.value)}
                            />
                          </div>

                          {/* Primary Test Voice Button */}
                          <button
                            type="button"
                            onClick={() => handlePlayCartesiaVoice()}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                          >
                            {isPlayingCartesiaAudio ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Stop Speaking</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 fill-white" />
                                <span>🔊 Speak Script with AI Voice (Test Here)</span>
                              </>
                            )}
                          </button>

                          <p className="text-[10px] text-gray-500 leading-normal italic">
                            ✓ Synthesizes using your configured Cartesia Hindi voice ({voiceLanguage === 'hi' ? '39d518b7...' : '248be419...'} at {voiceLanguage === 'hi' ? '0.85x' : '1.0x'} speed) directly into your browser speakers.
                          </p>
                        </div>
                      </div>

                      {/* Optional Handset Call Testing (Subtle light-themed footer) */}
                      <div className="mt-4 pt-3 border-t border-[#F2DED6] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                            <PhoneOutgoing className="w-3 h-3 text-primary" />
                            Optional: Ring Handset via SIP Trunk
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">+91 7965853227</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="+91 9876543210"
                            value={testPhoneNumber}
                            onChange={(e) => setTestPhoneNumber(e.target.value)}
                            className="flex-1 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleTestCall}
                            disabled={isTestCalling || !testPhoneNumber.trim()}
                            className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                          >
                            {isTestCalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneOutgoing className="w-3 h-3" />}
                            {isTestCalling ? 'Calling...' : 'Dial Phone'}
                          </button>
                        </div>
                        {testCallFeedback && (
                          <div
                            className={`p-2 rounded-lg text-[11px] leading-tight ${
                              testCallFeedback.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                : 'bg-red-50 border border-red-200 text-red-800'
                            }`}
                          >
                            {testCallFeedback.message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard (non-voice) form section */
                  <>
                    <button
                      onClick={handleGenerateContent}
                      disabled={isGeneratingContent || !productName || !productInfo}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                      {isGeneratingContent ? 'Generating with AI...' : 'Generate Content'}
                    </button>

                    {generatedContent && (
                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Review Content</label>
                          <textarea
                            className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[150px]"
                            value={generatedContent}
                            onChange={(e) => setGeneratedContent(e.target.value)}
                          />
                        </div>

                        {action === 'post' && (
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Add an Image (Optional)</label>
                            <div className="flex gap-4 mb-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="imageOption"
                                  value="none"
                                  checked={imageOption === 'none'}
                                  onChange={() => setImageOption('none')}
                                  className="text-primary focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">No Image</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="imageOption"
                                  value="upload"
                                  checked={imageOption === 'upload'}
                                  onChange={() => setImageOption('upload')}
                                  className="text-primary focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">Upload Image</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="imageOption"
                                  value="generate"
                                  checked={imageOption === 'generate'}
                                  onChange={() => setImageOption('generate')}
                                  className="text-primary focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">AI Generate</span>
                              </label>
                            </div>

                            {imageOption === 'generate' && !imageUrl && (
                              <button
                                onClick={handleGenerateImage}
                                disabled={isGeneratingImage}
                                className="w-full bg-white border border-[#F2DED6] hover:bg-gray-50 text-gray-900 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                {isGeneratingImage ? 'Generating Image...' : 'Generate Image (FLUX.1-schnell)'}
                              </button>
                            )}

                            {imageOption === 'upload' && !imageUrl && (
                              <div className="w-full">
                                <input
                                  type="file"
                                  accept="image/*"
                                  ref={fileInputRef}
                                  onChange={handleUploadImage}
                                  className="hidden"
                                />
                                <button
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploadingImage}
                                  className="w-full bg-white border border-[#F2DED6] hover:bg-gray-50 text-gray-900 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                  {isUploadingImage ? 'Uploading...' : 'Click to Upload Image'}
                                </button>
                              </div>
                            )}

                            {imageUrl && imageOption !== 'none' && (
                              <div className="mt-4 border border-gray-200 rounded-lg p-2 bg-white relative">
                                <img src={imageUrl} alt="Campaign Media" className="w-full h-auto rounded-md object-contain max-h-[300px]" />
                                <button
                                  onClick={() => setImageUrl('')}
                                  className="absolute top-4 right-4 bg-white/80 p-1.5 rounded-full hover:bg-white text-gray-700 shadow-sm"
                                  title="Remove Image"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {['email', 'sms', 'whatsapp'].includes(campaignType) && (
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Audience</h3>
                            <div className="mb-3">
                              <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 p-2 rounded border border-emerald-200">
                                <input
                                  type="checkbox"
                                  checked={onlyVerifiedEmails}
                                  onChange={(e) => setOnlyVerifiedEmails(e.target.checked)}
                                  className="text-emerald-600 focus:ring-emerald-500 rounded"
                                />
                                <span className="text-sm font-medium text-emerald-800">Only send to Verified Emails</span>
                              </label>
                            </div>

                            <div className="space-y-2 max-h-40 overflow-y-auto bg-white p-2 border border-gray-200 rounded">
                              {industryGroups.length === 0 ? (
                                <p className="text-xs text-gray-500 italic">No leads found. Discover leads first.</p>
                              ) : (
                                industryGroups.map(group => (
                                  <div key={group.industry} className="flex flex-col border border-gray-200 rounded overflow-hidden mb-1">
                                    <div className="flex items-center p-2 hover:bg-gray-50 bg-white">
                                      <input
                                        type="checkbox"
                                        checked={selectedIndustries.has(group.industry)}
                                        onChange={() => toggleIndustrySelection(group.industry, group.leads)}
                                        className="w-3.5 h-3.5 mr-2 text-primary focus:ring-primary rounded border-gray-300 cursor-pointer"
                                      />
                                      <div
                                        className="flex justify-between flex-1 cursor-pointer"
                                        onClick={() => toggleIndustryExpanded(group.industry)}
                                      >
                                        <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                          {expandedIndustries.has(group.industry) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                          {group.industry}
                                        </span>
                                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">{group.lead_count} leads</span>
                                      </div>
                                    </div>
                                    {expandedIndustries.has(group.industry) && (
                                      <div className="bg-gray-50 p-1.5 border-t border-gray-200 pl-6 max-h-32 overflow-y-auto">
                                        {(group.leads || [])
                                          .filter((l: any) => ['sms', 'whatsapp'].includes(campaignType) ? l.phone : l.email)
                                          .map((lead: any, i: number) => {
                                            const isSelected = ['sms', 'whatsapp'].includes(campaignType) ? selectedLeadPhones.has(lead.phone) : selectedLeadEmails.has(lead.email);
                                            const isDisabled = campaignType === 'email' && onlyVerifiedEmails && !lead.is_verified;
                                            return (
                                              <label key={i} className={`flex items-center p-1 hover:bg-white rounded transition-colors ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => {
                                                    if (!isDisabled) {
                                                      if (['sms', 'whatsapp'].includes(campaignType)) {
                                                        toggleLeadPhoneSelection(lead.phone);
                                                      } else {
                                                        toggleLeadSelection(lead.email);
                                                      }
                                                    }
                                                  }}
                                                  disabled={isDisabled}
                                                  className="w-3 h-3 text-primary focus:ring-primary rounded border-gray-300 disabled:opacity-50"
                                                />
                                                <div className="flex flex-col ml-2">
                                                  <span className="text-xs font-medium text-gray-800 flex items-center gap-1">
                                                    {lead.name || 'Unnamed'}
                                                    {campaignType === 'email' && lead.is_verified && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded leading-none">✓ Verified</span>}
                                                  </span>
                                                  <span className="text-[10px] text-gray-500">{['sms', 'whatsapp'].includes(campaignType) ? lead.phone : getDisplayEmail(lead)}</span>
                                                </div>
                                              </label>
                                            );
                                          })}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dynamic Deliverability & Safe Pacing Advisor */}
                        {['email', 'whatsapp'].includes(campaignType) && renderDeliverabilityAdvisor(
                          campaignType,
                          campaignType === 'email' ? selectedLeadEmails.size : selectedLeadPhones.size
                        )}

                        <div className="flex gap-4">
                          <button
                            onClick={handleSaveDraft}
                            disabled={isSavingDraft || isPublishing}
                            className="w-1/3 bg-white border border-[#F2DED6] hover:bg-gray-50 text-gray-900 font-medium py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isSavingDraft ? 'Saving...' : 'Save Draft'}
                          </button>

                          <button
                            onClick={handlePublish}
                            disabled={isPublishing || isSavingDraft || (campaignType === 'email' && selectedLeadEmails.size === 0)}
                            className="w-2/3 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isPublishing ? 'Publishing...' : `Publish to ${campaignType.charAt(0).toUpperCase() + campaignType.slice(1)}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* SMS Logs Section */}
                {viewingCampaign && viewingCampaign.type?.toLowerCase() === 'sms' && viewingCampaign.status === 'Active' && (
                  <div className="mt-8 border-t border-gray-100 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-primary" />
                      Sent Messages Log ({smsLogs.length})
                    </h3>
                    {smsLogs.length === 0 ? (
                      <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg border border-gray-200">No messages have been sent yet.</p>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                            <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <th className="p-3">Recipient</th>
                              <th className="p-3 w-1/2">Message Content</th>
                              <th className="p-3">Sent At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {smsLogs.map((log: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50 text-sm align-top">
                                <td className="p-3">
                                  <div className="font-medium text-gray-900">{log.lead_name || 'Unknown'}</div>
                                  <div className="text-gray-500 text-xs mt-0.5">{log.lead_phone}</div>
                                </td>
                                <td className="p-3 text-gray-700">
                                  <div className="whitespace-pre-wrap text-xs bg-gray-50 border border-gray-100 p-2 rounded">{log.content}</div>
                                </td>
                                <td className="p-3 text-gray-500 text-xs whitespace-nowrap">
                                  {new Date(log.sent_at).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* View Campaign Modal */}
      {viewingCampaign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#FAF8F5] border border-[#F2DED6] flex items-center justify-center shrink-0">
                  {viewingCampaign.icon && <viewingCampaign.icon className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-900">{viewingCampaign.name}</h2>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      viewingCampaign.status === 'Completed' || viewingCampaign.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : viewingCampaign.status === 'Draft'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {viewingCampaign.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {viewingCampaign.type} Campaign • Created {viewingCampaign.date || 'Recently'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Header Quick Reuse Button */}
                <button
                  onClick={() => handleReuseCampaign(viewingCampaign)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold shadow-xs transition-all hover:scale-[1.02]"
                  title="Reuse and clone this campaign"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reuse Campaign</span>
                </button>

                <button
                  onClick={() => deleteCampaign(viewingCampaign.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-gray-200"
                  title="Delete Campaign"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setViewingCampaign(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-white">
              {/* Voice-Specific View */}
              {(viewingCampaign.type?.toLowerCase() === 'voice' || viewingCampaign.type?.toLowerCase() === 'call') ? (
                <div className="space-y-5">
                  {/* Voice Telephony Metadata Card */}
                  <div className="bg-[#FAF8F5] border border-[#F2DED6] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-primary" />
                        Voice Model & Telephony Parameters
                      </span>
                      <span className="text-[11px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                        Cartesia Sonic-3
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-[#F2DED6]/60">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Language</span>
                        <span className="font-bold text-gray-800">
                          {viewingCampaign.language === 'hi' ? '🇮🇳 Hindi (hi)' : viewingCampaign.language === 'en' ? '🇺🇸 English (en)' : '🪄 Auto'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-[#F2DED6]/60">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">TTS Voice ID</span>
                        <span className="font-mono font-medium text-gray-800 truncate block" title={viewingCampaign.voice_id || '39d518b7-fd0b-4676-9b8b-29d64ff31e12'}>
                          {viewingCampaign.voice_id ? viewingCampaign.voice_id.slice(0, 8) + '...' : '39d518b7...'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-[#F2DED6]/60">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Speaking Pace</span>
                        <span className="font-bold text-gray-800">
                          {viewingCampaign.language === 'hi' ? '0.85x speed' : '1.0x speed'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-[#F2DED6]/60">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Calls Made</span>
                        <span className="font-bold text-emerald-700">
                          {viewingCampaign.sent || 0} / {viewingCampaign.total_leads || (viewingCampaign.audience?.length) || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Opening Greeting Message */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-primary" />
                        First Greeting Message
                      </h3>
                      <button
                        onClick={() => handlePlayCartesiaVoice(viewingCampaign.first_message, viewingCampaign.language)}
                        className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 bg-[#FAF8F5] px-2.5 py-1 rounded-md border border-[#F2DED6] transition-colors"
                      >
                        {isPlayingCartesiaAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        {isPlayingCartesiaAudio ? 'Playing...' : 'Listen Sample'}
                      </button>
                    </div>
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800 font-medium">
                      "{viewingCampaign.first_message || "Hello! Thanks for taking my call."}"
                    </div>
                  </div>

                  {/* Agent Instructions / System Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        AI Agent System Instructions & Prompt
                      </h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(viewingCampaign.prompt || viewingCampaign.content || '');
                          setHasCopiedContent(true);
                          setTimeout(() => setHasCopiedContent(false), 2000);
                        }}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-gray-200 transition-colors shadow-2xs"
                      >
                        {hasCopiedContent ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {hasCopiedContent ? 'Copied!' : 'Copy Prompt'}
                      </button>
                    </div>
                    <pre className="p-4 bg-gray-900 text-gray-100 rounded-xl border border-gray-800 text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {viewingCampaign.prompt || viewingCampaign.content || "No prompt stored."}
                    </pre>
                  </div>

                  {/* Link to Call Transcripts and Audio */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <PhoneCall className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-900">Live Call Transcripts & Audio Recordings</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          View full multi-turn dialogue transcripts, listen to phone recordings, and inspect checklist outcomes.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => window.location.href = '/app/calls'}
                      className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Call Logs →
                    </button>
                  </div>
                </div>
              ) : (
                /* Non-Voice Campaign Content */
                <div className="space-y-5">
                  {/* WhatsApp Anti-Ban Safe Pacing Banner */}
                  {viewingCampaign.type === 'WhatsApp' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                            WhatsApp Anti-Ban Safe Pacing Engine
                            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                          </h4>
                          <p className="text-xs text-emerald-700 mt-0.5">
                            {viewingCampaign.dispatch_status || "4-7s randomized jitter delays and cooldown intervals protect your phone number from spam flags."}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => window.location.href = '/app/whatsapp-logs'}
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Live WhatsApp Logs →
                      </button>
                    </div>
                  )}

                  {/* Campaign Content Copy */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary" />
                        Campaign Message Content
                      </h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(viewingCampaign.content || '');
                          setHasCopiedContent(true);
                          setTimeout(() => setHasCopiedContent(false), 2000);
                        }}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-gray-200 transition-colors shadow-2xs"
                      >
                        {hasCopiedContent ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {hasCopiedContent ? 'Copied!' : 'Copy Text'}
                      </button>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {viewingCampaign.content || "No additional content details available for this campaign."}
                    </div>
                  </div>

                  {viewingCampaign.image_url && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Attached Image</h3>
                      <img
                        src={viewingCampaign.image_url.startsWith('http') ? viewingCampaign.image_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${viewingCampaign.image_url}`}
                        alt="Campaign"
                        className="w-full max-w-sm rounded-xl border border-gray-200 shadow-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Target Audience Section */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    Target Audience
                    <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      {(viewingCampaign.audience?.length || viewingCampaign.leads?.length || 0)} Contacts
                    </span>
                  </h3>
                  <button
                    onClick={() => handleReuseCampaign(viewingCampaign)}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Load into Campaign Creator
                  </button>
                </div>

                {viewingCampaign.audience && viewingCampaign.audience.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                          <th className="p-3">Name</th>
                          <th className="p-3">Contact (Phone / Email)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {viewingCampaign.audience.map((member: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 text-gray-900 font-medium">{member.name || 'Prospect'}</td>
                            <td className="p-3 text-gray-500 font-mono text-xs">{member.contact || member.phone || member.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">
                      Target leads can be modified or selected dynamically when you click "Reuse Campaign".
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Reuse Campaign action */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                {viewingCampaign.name} • {viewingCampaign.type}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewingCampaign(null)}
                  className="px-4 py-2 border border-gray-300 hover:bg-white text-gray-700 font-medium text-xs rounded-lg transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleReuseCampaign(viewingCampaign)}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-all hover:scale-[1.02]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reuse / Relaunch Campaign</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
