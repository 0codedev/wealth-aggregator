
import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../shared/ToastProvider';
import {
    Mic, Zap, Loader2, FileText,
    AlertTriangle, Lightbulb, TrendingUp, ArrowRight,
    Award, Shield, PieChart, MessageSquare,
    Send, Image as ImageIcon, User, Bot, Paperclip, X,
    Sparkles, Star, ChevronDown, Check, ChevronUp, Maximize2, Flame, Trash2,
    History, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { BubbleSkeleton, CardSkeleton } from '../shared/LoadingSkeleton';
import { Investment } from '../../types';
import * as AIService from '../../services/aiService';
import { SEBI_COMPLIANCE_CORE } from '../../services/aiService';
import { blobToBase64, compressImage } from '../../utils/helpers';
import MorningBriefing from '../MorningBriefing';
import { useConversations } from '../../hooks/useConversations';
import { ConversationsSidebar } from '../ai/ConversationsSidebar';

interface AdvisorTabProps {
    investments: Investment[];
    totalNetWorth: string;
    onNavigate: (tab: string) => void;
}

interface AdvisorData {
    grades: {
        diversification: string;
        riskProfile: string;
        assetQuality: string;
    };
    summary: string;
    risks: string[];
    opportunities: string[];
    actions: string[];
}

// --- Constants ---
// --- Constants ---
const MODELS = [
    { id: 'gemini-2.5-flash', label: '2.5 Flash', icon: Zap, description: 'Fastest' },
    { id: 'gemini-2.5-pro', label: '2.5 Pro', icon: Star, description: 'Smartest' },
];

const PERSONAS = [
    { id: 'standard', label: 'Standard Advisor', icon: Shield, prompt: "You are a professional, balanced financial advisor. Focus on risk management and steady growth." },
    { id: 'buffett', label: 'Oracle of Omaha', icon: TrendingUp, prompt: "You are Warren Buffett. Speak in wise, folk-sy aphorisms. Focus on value, moats, and long-term holding. Disdain speculation." },
    { id: 'belfort', label: 'Wolf mode', icon: Zap, prompt: "You are Jordan Belfort (The Wolf of Wall Street). High energy, aggressive sales pitch style. Push for action, but keep it legal. Use phrases like 'Pick up the phone!' or 'Opportunity of a lifetime!'." },
    { id: 'roast', label: 'Roast Master', icon: Flame, prompt: "You are a savage comedian financial auditor. Roast the user's bad decisions mercilessly. accessible but brutal. Make fun of high risk/low reward trades." },
];

// --- Markdown Rendering Utils ---

const formatInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-indigo-600 dark:text-indigo-300">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i} className="italic text-slate-500 dark:text-slate-400">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-xs font-mono text-emerald-600 dark:text-emerald-400">{part.slice(1, -1)}</code>;
        }
        return part;
    });
};

const renderMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    let listBuffer: React.ReactNode[] = [];
    let isOrderedList = false;

    const flushList = () => {
        if (listBuffer.length > 0) {
            const ListTag = isOrderedList ? 'ol' : 'ul';
            elements.push(
                <ListTag key={`list-${elements.length}`} className={`mb-4 pl-5 ${isOrderedList ? 'list-decimal' : 'list-disc'} space-y-1 text-slate-700 dark:text-slate-300`}>
                    {listBuffer}
                </ListTag>
            );
            listBuffer = [];
        }
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        // Headings
        if (line.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={index} className="text-md font-bold text-indigo-600 dark:text-indigo-400 mt-6 mb-2 flex items-center gap-2"><Sparkles size={14} /> {formatInline(line.replace('### ', ''))}</h3>);
        } else if (line.startsWith('## ')) {
            flushList();
            elements.push(<h2 key={index} className="text-lg font-bold text-slate-900 dark:text-white border-b border-indigo-100 dark:border-indigo-500/30 pb-2 mt-8 mb-4">{formatInline(line.replace('## ', ''))}</h2>);
        } else if (line.startsWith('# ')) {
            flushList();
            elements.push(<h1 key={index} className="text-2xl font-black text-slate-900 dark:text-white mt-6 mb-6">{formatInline(line.replace('# ', ''))}</h1>);
        }
        // Lists
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            isOrderedList = false;
            listBuffer.push(<li key={index} className="pl-1">{formatInline(trimmed.replace(/^[-*]\s+/, ''))}</li>);
        } else if (/^\d+\.\s/.test(trimmed)) {
            isOrderedList = true;
            listBuffer.push(<li key={index} className="pl-1">{formatInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>);
        }
        // Empty lines
        else if (trimmed === '') {
            flushList();
            elements.push(<div key={index} className="h-3"></div>);
        }
        // Regular Text
        else {
            flushList();
            elements.push(<p key={index} className="text-slate-700 dark:text-slate-300 mb-1 leading-relaxed">{formatInline(line)}</p>);
        }
    });

    flushList();
    return elements;
};

// --- Visual Components ---

const VoiceOrb = ({ isActive }: { isActive: boolean }) => {
    return (
        <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
            <div className={`absolute w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-[0_0_30px_rgba(99,102,241,0.6)] z-20 transition-all duration-500 ${isActive ? 'scale-110 shadow-[0_0_50px_rgba(99,102,241,0.8)]' : 'scale-100'}`}></div>
            <div className={`absolute w-16 h-16 md:w-24 md:h-24 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 z-10 transition-all duration-1000 ${isActive ? 'animate-[spin_3s_linear_infinite]' : ''}`}></div>
            <div className={`absolute w-24 h-24 md:w-32 md:h-32 rounded-full border border-purple-400/20 border-b-purple-400 z-0 transition-all duration-1000 ${isActive ? 'animate-[spin_5s_linear_infinite_reverse]' : ''}`}></div>
            {isActive && (
                <>
                    <div className="absolute w-full h-full rounded-full bg-indigo-500/20 animate-ping"></div>
                    <div className="absolute w-full h-full rounded-full bg-purple-500/20 animate-ping delay-150"></div>
                </>
            )}
        </div>
    );
};

const GradeBadge = ({ grade, label, icon: Icon }: { grade: string, label: string, icon: any }) => {
    const getColor = (g: string) => {
        if (g.startsWith('A')) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        if (g.startsWith('B')) return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
        if (g.startsWith('C')) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    };

    const colorClass = getColor(grade);

    return (
        <div className={`flex flex-col items-center justify-center p-4 rounded-2xl border ${colorClass} transition-all hover:scale-105`}>
            <div className="flex items-center gap-2 mb-2 opacity-80">
                <Icon size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            <span className="text-4xl font-black tracking-tighter">{grade}</span>
        </div>
    );
};

const ReportCard = ({ data }: { data: AdvisorData }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-in zoom-in duration-300">
            <GradeBadge grade={data.grades.diversification} label="Diversification" icon={PieChart} />
            <GradeBadge grade={data.grades.riskProfile} label="Risk Management" icon={Shield} />
            <GradeBadge grade={data.grades.assetQuality} label="Asset Quality" icon={Award} />
        </div>
    );
};

const ActionList = ({ items, onNavigate, type }: { items: string[], onNavigate: (t: string) => void, type: 'RISK' | 'OPP' | 'ACTION' }) => {
    const config = {
        RISK: { color: 'rose', icon: AlertTriangle, title: 'Critical Risks' },
        OPP: { color: 'emerald', icon: Lightbulb, title: 'Opportunities' },
        ACTION: { color: 'indigo', icon: TrendingUp, title: 'Execution Plan' }
    }[type];

    if (!items || items.length === 0) return null;

    return (
        <div className={`bg-${config.color}-50 dark:bg-${config.color}-900/10 border border-${config.color}-100 dark:border-${config.color}-900/30 rounded-xl p-5 mb-4 animate-in slide-in-from-bottom-4`}>
            <h4 className={`flex items-center gap-2 text-${config.color}-700 dark:text-${config.color}-400 font-bold mb-4 uppercase tracking-wider text-sm`}>
                <config.icon size={18} /> {config.title}
            </h4>
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Chat Components ---

interface ChatBubbleProps {
    role: 'user' | 'model';
    text?: string;
    image?: string | null;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ role, text, image }) => {
    const isUser = role === 'user';
    return (
        <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            {/* Width logic: User ~80%, AI ~98% (almost full width for reports) */}
            <div className={`flex ${isUser ? 'max-w-[80%]' : 'max-w-[98%] w-full'} gap-4 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isUser ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-indigo-600 border border-slate-200 dark:border-slate-700'}`}>
                    {isUser ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`flex flex-col gap-2 ${!isUser ? 'flex-1 min-w-0' : ''}`}>
                    <div className={`p-5 rounded-2xl shadow-sm border ${isUser ? 'bg-indigo-600 text-white border-indigo-600 rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-tl-sm w-full'}`}>
                        {image && (
                            <img src={image} alt="Upload" className="rounded-lg max-h-64 object-cover border border-white/20 mb-3" />
                        )}
                        {text && <div className="text-sm">{renderMarkdown(text)}</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ModelSelector = ({ selected, onSelect }: { selected: string, onSelect: (id: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedModel = MODELS.find(m => m.id === selected) || MODELS[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700"
            >
                <Sparkles size={14} className="text-indigo-500" />
                <span>{selectedModel.label}</span>
                <ChevronDown size={14} className="opacity-50" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {MODELS.map((m) => (
                            <button
                                key={m.label}
                                onClick={() => { onSelect(m.id); setIsOpen(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                            >
                                <div className={`p-2 rounded-lg ${selected === m.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    <m.icon size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{m.label}</p>
                                    <p className="text-[10px] text-slate-400">{m.description}</p>
                                </div>
                                {selected === m.id && <Check size={14} className="ml-auto text-indigo-500" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const PersonaSelector = ({ selected, onSelect }: { selected: string, onSelect: (id: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedPersona = PERSONAS.find(p => p.id === selected) || PERSONAS[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700"
            >
                <selectedPersona.icon size={14} className="text-fuchsia-500" />
                <span>{selectedPersona.label}</span>
                <ChevronDown size={14} className="opacity-50" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {PERSONAS.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => { onSelect(p.id); setIsOpen(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                            >
                                <div className={`p-2 rounded-lg ${selected === p.id ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    <p.icon size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{p.label}</p>
                                </div>
                                {selected === p.id && <Check size={14} className="ml-auto text-fuchsia-500" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// --- Helper: Context Aware Prompts ---
const getContextAwarePrompts = (investments: Investment[], netWorth: string) => {
    const prompts = ["Analyze my risk exposure", "Upload Chart Screenshot"];

    // 1. Check for high cash (Opportunity)
    const cash = investments.find(i => i.type === 'Cash/Bank')?.currentValue || 0;
    const total = parseFloat(netWorth.replace(/[^0-9.-]+/g, ""));
    if (total > 0 && (cash / total) > 0.2) {
        prompts.push("Where should I deploy my idle cash?");
    }

    // 2. Check for crypto exposure (Risk)
    const crypto = investments.filter(i => i.type === 'Crypto').reduce((acc, i) => acc + i.currentValue, 0);
    if (total > 0 && (crypto / total) > 0.15) {
        prompts.push("Is my crypto allocation too high?");
    }

    // 3. Tax Season (Time based - simplified)
    const month = new Date().getMonth();
    if (month >= 0 && month <= 2) { // Jan-Mar
        prompts.push("How to save tax before March 31?");
    }

    // 4. Default fallback
    if (prompts.length < 4) {
        prompts.push("Review portfolio diversity");
    }

    return prompts.slice(0, 4);
};

// --- Main Advisor Component ---

const AdvisorTab: React.FC<AdvisorTabProps> = ({ investments, totalNetWorth, onNavigate }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'CHAT' | 'VOICE'>('CHAT');
    const contextPrompts = useRef(getContextAwarePrompts(investments, totalNetWorth)).current;

    // Voice State
    const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
    const [advisorData, setAdvisorData] = useState<AdvisorData | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const liveSessionRef = useRef<AIService.LiveVoiceSession | null>(null);

    // Chat State
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text?: string, image?: string | null }[]>(() => {
        const saved = localStorage.getItem('advisor_chat_history');
        return saved ? JSON.parse(saved) : [];
    });
    const [chatInput, setChatInput] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('gemini-2.5-flash');
    const [selectedPersonaId, setSelectedPersonaId] = useState('standard');
    const [isSending, setIsSending] = useState(false);
    const [chatImage, setChatImage] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isInputVisible, setIsInputVisible] = useState(true);

    // Conversation Memory (P1 Enhancement)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const {
        conversations,
        activeConversation,
        createConversation,
        loadConversation,
        deleteConversation,
        renameConversation,
        messages: persistedMessages,
        addMessage: addPersistedMessage,
        clearMessages: clearPersistedMessages
    } = useConversations(selectedPersonaId);

    useEffect(() => {
        liveSessionRef.current = new AIService.LiveVoiceSession();
        return () => {
            liveSessionRef.current?.stop();
        };
    }, []);

    useEffect(() => {
        if (activeTab === 'CHAT' && isInputVisible) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, activeTab, isInputVisible]);

    // Persist Chat History
    useEffect(() => {
        localStorage.setItem('advisor_chat_history', JSON.stringify(chatMessages));
    }, [chatMessages]);

    // Persist Advisor Data (Audit Report)
    useEffect(() => {
        if (advisorData) {
            localStorage.setItem('advisor_report_data', JSON.stringify(advisorData));
        } else {
            // Only remove if explicitly null (cleared), but we can also choose to keep it.
            // For now, let's keep it until explicitly cleared via handleClearChat
        }
    }, [advisorData]);

    // Load Advisor Data on Mount
    useEffect(() => {
        const savedReport = localStorage.getItem('advisor_report_data');
        if (savedReport) {
            try {
                setAdvisorData(JSON.parse(savedReport));
            } catch (e) {
                console.error("Failed to load saved report", e);
            }
        }
    }, []);

    const handleClearChat = () => {
        setChatMessages([]);
        setAdvisorData(null);
        localStorage.removeItem('advisor_chat_history');
        localStorage.removeItem('advisor_report_data');
        toast.success("Chat history & reports cleared");
    };

    // --- Voice Handlers ---
    const handleToggleLiveSession = async () => {
        if (isLiveSessionActive) {
            liveSessionRef.current?.stop();
            setIsLiveSessionActive(false);
        } else {
            try {
                const persona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];
                const systemInstructions = `${persona.prompt} Net Worth: ${totalNetWorth}. Portfolio: ${JSON.stringify(investments)}. Answer questions concisely.`;
                await liveSessionRef.current?.start(systemInstructions);
                setIsLiveSessionActive(true);
            } catch (e) {
                console.error("Live Session Start Error:", e);
                toast.error('Failed to connect to Gemini Live. Please check your API key.');
                setIsLiveSessionActive(false);
            }
        }
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        setAdvisorData(null);
        try {
            const prompt = `
            Role: Senior Wealth Manager. Context: Portfolio: ${JSON.stringify(investments)}. Net Worth: ${totalNetWorth}.
            Task: Audit portfolio. Output JSON schema: { "grades": { "diversification": "Grade", "riskProfile": "Grade", "assetQuality": "Grade" }, "summary": "text", "risks": ["text"], "opportunities": ["text"], "actions": ["text"] }
          `;
            // Fix: Use standard askGemini (Flash) for reliable JSON generation, avoiding DeepThink issues
            const rawResponse = await AIService.askGemini(prompt, true);
            const cleanJson = rawResponse.replace(/```json|```/g, '').trim();
            const parsedData = JSON.parse(cleanJson);
            setAdvisorData(parsedData);

            // Add report to chat stream for history
            setChatMessages(prev => [...prev, { role: 'model', text: "I've generated a comprehensive portfolio audit report for you.", image: null }]);
        } catch (e) {
            console.error("Report Failed", e);
            setChatMessages(prev => [...prev, { role: 'model', text: "Error generating report. Please try again later.", image: null }]);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // --- Chat Handlers ---
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const blob = await compressImage(file);
                const base64 = await blobToBase64(blob);
                setChatImage(base64);
            } catch (err) { console.error(err); }
        }
    };

    const handleSendMessage = async () => {
        if ((!chatInput.trim() && !chatImage) || isSending) return;

        const userText = chatInput.trim();
        const userImage = chatImage;

        setChatInput('');
        setChatImage(null);
        setIsSending(true);

        const newHistory = [...chatMessages, { role: 'user' as const, text: userText, image: userImage }];
        setChatMessages(newHistory);

        try {
            const apiHistory = chatMessages.map(msg => ({
                role: msg.role,
                parts: msg.image
                    ? [{ inlineData: { mimeType: 'image/png', data: msg.image.split(',')[1] } }, { text: msg.text || '' }]
                    : [{ text: msg.text || '' }]
            }));

            const apiMessage = userImage
                ? [{ inlineData: { mimeType: 'image/png', data: userImage.split(',')[1] } }, { text: userText || 'Analyze this image' }]
                : userText;

            const persona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];
            const systemContext = `${persona.prompt}\n\n${SEBI_COMPLIANCE_CORE}\n\nUSER PORTFOLIO:\nNet Worth: ${totalNetWorth}\nHoldings: ${JSON.stringify(investments.map(i => ({ name: i.name, type: i.type, val: i.currentValue })))}`;

            const responseText = await AIService.chatWithGemini(selectedModelId, apiHistory, apiMessage, systemContext);
            setChatMessages(prev => [...prev, { role: 'model', text: responseText, image: null }]);
        } catch (error: any) {
            console.error("Chat Error", error);
            setChatMessages(prev => [...prev, { role: 'model', text: `Error: ${error.message || "Unable to process request."}`, image: null }]);
        } finally {
            setIsSending(false);
        }
    };

    const renderHeader = () => (
        <div className="flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm z-30 relative shrink-0">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('CHAT')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'CHAT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                >
                    <MessageSquare size={14} /> Chat
                </button>
                <button
                    onClick={() => setActiveTab('VOICE')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'VOICE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                >
                    <Mic size={14} /> Voice
                </button>
            </div>

            <div className="flex items-center gap-2">
                {/* History Toggle Button - P1 Enhancement */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`p-2 rounded-lg transition-colors ${isSidebarOpen
                        ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-500/20'
                        : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    title="Conversation History"
                >
                    <History size={16} />
                </button>
                {chatMessages.length > 0 && (
                    <button
                        onClick={handleClearChat}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                        title="Clear Chat History"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
                <PersonaSelector selected={selectedPersonaId} onSelect={setSelectedPersonaId} />
                <ModelSelector selected={selectedModelId} onSelect={setSelectedModelId} />
                <button
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport}
                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-1 shadow-sm"
                >
                    {isGeneratingReport ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Audit Report
                </button>
            </div>
        </div>
    );

    return (
        <div className="-m-4 md:-m-8 h-[calc(100vh-4rem)] flex flex-col relative bg-slate-50 dark:bg-slate-950">

            {/* Unified Header (Chat/Voice Toggle + Model + Report) */}
            {/* Header Moved Inside Tabs for Scroll Behavior */}

            {activeTab === 'CHAT' ? (
                <div className="flex flex-col h-full overflow-hidden relative">
                    {/* Header - Fixed at Top (Outside Scroll) */}
                    {renderHeader()}

                    {/* Main Content with Sidebar */}
                    <div className="flex flex-1 overflow-hidden">
                        {/* Conversations Sidebar - P1 Enhancement */}
                        {isSidebarOpen && (
                            <div className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0 h-full">
                                <ConversationsSidebar
                                    conversations={conversations}
                                    activeConversationId={activeConversation?.id || null}
                                    onSelect={loadConversation}
                                    onNew={() => createConversation(selectedPersonaId)}
                                    onDelete={deleteConversation}
                                    onRename={renameConversation}
                                />
                            </div>
                        )}

                        {/* Chat Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth pb-24">
                            {chatMessages.length === 0 && !advisorData ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                                    <MorningBriefing investments={investments} totalNetWorth={totalNetWorth} />

                                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm mt-8">
                                        <Bot size={40} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Wealth Advisor AI</h3>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        Ask about your portfolio, upload charts, or generate a full audit.
                                    </p>

                                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                                        {contextPrompts.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => q.includes('Upload') ? fileInputRef.current?.click() : setChatInput(q)}
                                                className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-all text-left"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-5xl mx-auto">
                                    {chatMessages.map((msg, idx) => (
                                        <ChatBubble key={idx} role={msg.role} text={msg.text} image={msg.image} />
                                    ))}

                                    {/* Inline Report View if available */}
                                    {isGeneratingReport && (
                                        <div className="mt-4 mb-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                                            <CardSkeleton />
                                        </div>
                                    )}

                                    {advisorData && (
                                        <div className="mt-4 mb-8 pt-6 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2">
                                                    <FileText size={20} className="text-indigo-500" />
                                                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Portfolio Audit Report</h3>
                                                </div>
                                                <button onClick={() => setAdvisorData(null)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
                                            </div>
                                            <ReportCard data={advisorData} />
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <ActionList items={advisorData.risks} type="RISK" onNavigate={onNavigate} />
                                                <ActionList items={advisorData.opportunities} type="OPP" onNavigate={onNavigate} />
                                            </div>
                                        </div>
                                    )}

                                    {isSending && <BubbleSkeleton />}
                                    <div ref={chatEndRef}></div>
                                </div>
                            )}
                        </div>

                        {/* Input Area (Collapsible) */}
                        <div className={`absolute bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${isInputVisible ? 'translate-y-0' : 'translate-y-[calc(100%-4px)]'}`}>
                            {/* Drag Handle / Toggle Button */}
                            <div className="flex justify-center -mb-3 relative z-50 pointer-events-none">
                                <button
                                    onClick={() => setIsInputVisible(!isInputVisible)}
                                    className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-1.5 text-slate-400 hover:text-indigo-600 shadow-sm hover:shadow-md transition-all active:scale-95"
                                    title={isInputVisible ? "Minimize Input" : "Restore Input"}
                                >
                                    {isInputVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                                <div className="w-full max-w-5xl mx-auto space-y-3">
                                    {chatImage && (
                                        <div className="inline-flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2">
                                            <div className="h-10 w-10 rounded-lg overflow-hidden relative">
                                                <img src={chatImage} className="object-cover w-full h-full" alt="preview" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Image attached</span>
                                            <button onClick={() => setChatImage(null)} className="ml-2 p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-full text-slate-400 hover:text-rose-500"><X size={14} /></button>
                                        </div>
                                    )}

                                    <div className="flex gap-2 items-end">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-500 rounded-2xl transition-colors border border-slate-200 dark:border-slate-800"
                                            title="Upload Image"
                                        >
                                            <Paperclip size={20} />
                                        </button>

                                        <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex flex-col">
                                            <textarea
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                                placeholder="Type a message..."
                                                className="w-full bg-transparent border-none p-3.5 text-sm focus:ring-0 outline-none resize-none max-h-32 min-h-[50px] placeholder:text-slate-400 dark:text-white"
                                                rows={1}
                                            />
                                        </div>

                                        <button
                                            onClick={handleSendMessage}
                                            disabled={isSending || (!chatInput.trim() && !chatImage)}
                                            className="p-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-2xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                                        >
                                            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Restore Button (Visible only when input is hidden) */}
                        {!isInputVisible && (
                            <div className="absolute bottom-6 right-6 z-50 animate-in zoom-in duration-200">
                                <button
                                    onClick={() => setIsInputVisible(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 transition-all hover:scale-110 active:scale-95"
                                    title="Show Chat Input"
                                >
                                    <MessageSquare size={24} />
                                </button>
                            </div>
                        )}
                    </div> {/* End Main Content with Sidebar */}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center p-8 animate-in fade-in slide-in-from-right-4">
                    {renderHeader()}
                    <div className="flex-1 flex items-center justify-center w-full">
                        {/* Voice Interface */}
                        <div className={`w-full max-w-2xl bg-gradient-to-br ${isLiveSessionActive ? 'from-slate-900 to-indigo-950 border-indigo-500/50' : 'from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800'} p-12 rounded-[2rem] border shadow-2xl text-center transition-all duration-500 relative overflow-hidden group`}>

                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] transition-opacity duration-1000 ${isLiveSessionActive ? 'opacity-100' : 'opacity-0'}`}></div>

                            <div className="relative z-10 flex flex-col items-center">
                                <h3 className={`text-3xl font-black mb-3 transition-colors ${isLiveSessionActive ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                                    {isLiveSessionActive ? 'SYSTEM ONLINE' : 'VOICE NEURAL LINK'}
                                </h3>
                                <p className={`text-base mb-10 transition-colors ${isLiveSessionActive ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {isLiveSessionActive ? 'Listening to your commands...' : 'Tap the orb to initialize voice session'}
                                </p>

                                <div className="cursor-pointer hover:scale-105 transition-transform duration-300" onClick={handleToggleLiveSession}>
                                    <VoiceOrb isActive={isLiveSessionActive} />
                                </div>

                                <div className={`mt-12 px-6 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all ${isLiveSessionActive ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                                    {isLiveSessionActive ? 'Live Session Active' : 'System Standby'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvisorTab;
