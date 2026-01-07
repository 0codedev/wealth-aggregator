import React, { useState, useEffect, useMemo } from 'react';
import { CustomTooltip } from '../shared/CustomTooltip';
import {
    Globe, TrendingUp, TrendingDown, Activity,
    DollarSign, Droplets, Zap, AlertTriangle, Info,
    Coins, Scale, Calendar, BarChart3, Clock
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { IPOCalendarWidget } from '../market/IPOCalendarWidget';

// --- MOCK DATA GENERATORS ---
const generateTrendData = (startVal: number, volatility: number) => {
    let current = startVal;
    return Array.from({ length: 30 }, (_, i) => {
        const change = (Math.random() - 0.5) * volatility;
        current += change;
        return { day: i + 1, value: current };
    });
};

const INITIAL_MACRO_INDICATORS = [
    {
        id: 'vix',
        name: 'India VIX',
        label: 'Fear Index',
        value: 13.5,
        change: -2.4,
        unit: '',
        icon: Activity,
        color: '#f59e0b', // Amber
        data: generateTrendData(14, 0.5),
        desc: 'Market volatility expectation. < 15 is calm, > 20 is fearful.'
    },
    {
        id: 'usdinr',
        name: 'USD/INR',
        label: 'Currency',
        value: 84.12,
        change: 0.12,
        unit: '₹',
        icon: DollarSign,
        color: '#10b981', // Emerald
        data: generateTrendData(84.0, 0.1),
        desc: 'Rupee strength. Rising USD hurts importers, helps IT/Pharma.'
    },
    {
        id: 'crude',
        name: 'Brent Crude',
        label: 'Inflation Proxy',
        value: 78.45,
        change: -0.5,
        unit: '$',
        icon: Droplets,
        color: '#ef4444', // Red
        data: generateTrendData(79, 1.5),
        desc: 'Oil prices. High oil = High inflation for India.'
    },
    {
        id: 'us10y',
        name: 'US 10Y Yield',
        label: 'Global Liquidity',
        value: 4.42,
        change: 0.05,
        unit: '%',
        icon: Zap,
        color: '#6366f1', // Indigo
        data: generateTrendData(4.35, 0.05),
        desc: 'Risk-free rate. High yields suck capital from emerging markets.'
    },
    {
        id: 'gold',
        name: 'Gold (USD)',
        label: 'Safe Haven',
        value: 2150.80,
        change: 0.8,
        unit: '$',
        icon: Coins,
        color: '#eab308', // Yellow
        data: generateTrendData(2140, 10),
        desc: 'Gold prices. Rises during uncertainty and inflation.'
    },
    {
        id: 'dxy',
        name: 'Dollar Index',
        label: 'USD Strength',
        value: 103.8,
        change: -0.1,
        unit: '',
        icon: Scale,
        color: '#64748b', // Slate
        data: generateTrendData(104, 0.2),
        desc: 'Strength of USD vs major currencies. Inverse to emerging markets.'
    }
];

const INITIAL_GLOBAL_INDICES = [
    { name: 'S&P 500', value: 5120.50, change: 1.2 },
    { name: 'NASDAQ', value: 16250.25, change: 1.8 },
    { name: 'FTSE 100', value: 7710.10, change: -0.4 },
    { name: 'NIKKEI 225', value: 39500.00, change: 2.1 },
    { name: 'GIFT NIFTY', value: 22450.50, change: 0.5 },
    { name: 'BITCOIN', value: 64200.00, change: 5.2 },
];

const IMPACT_RULES = [
    {
        condition: (indicators: any) => indicators.find((i: any) => i.id === 'crude').change > 1,
        impact: 'NEGATIVE',
        sectors: ['Paints', 'Tyres', 'Aviation'],
        reason: 'Rising Crude Oil prices increase input costs for these sectors.'
    },
    {
        condition: (indicators: any) => indicators.find((i: any) => i.id === 'usdinr').change > 0.2,
        impact: 'POSITIVE',
        sectors: ['IT Services', 'Pharma'],
        reason: 'Weaker Rupee increases export earnings for IT and Pharma companies.'
    },
    {
        condition: (indicators: any) => indicators.find((i: any) => i.id === 'us10y').value > 4.5,
        impact: 'NEGATIVE',
        sectors: ['Banking', 'NBFCs'],
        reason: 'High US Yields trigger FII selling in financial stocks.'
    },
    {
        condition: (indicators: any) => indicators.find((i: any) => i.id === 'vix').value < 12,
        impact: 'POSITIVE',
        sectors: ['High Beta', 'Midcaps'],
        reason: 'Low volatility environment encourages risk-taking in mid/small caps.'
    },
    {
        condition: (indicators: any) => indicators.find((i: any) => i.id === 'gold').change > 1,
        impact: 'POSITIVE',
        sectors: ['Gold Loan NBFCs', 'Jewellery'],
        reason: 'Rising Gold prices increase collateral value and inventory value.'
    }
];

// Updated to Dec 2025 contextual dates
const ECONOMIC_CALENDAR = [
    { event: 'Fed Interest Rate Decision', date: 'Dec 18', impact: 'HIGH', forecast: '4.75%', previous: '5.00%' },
    { event: 'India CPI Inflation', date: 'Dec 12', impact: 'HIGH', forecast: '4.80%', previous: '5.10%' },
    { event: 'US Non-Farm Payrolls', date: 'Dec 06', impact: 'MEDIUM', forecast: '180K', previous: '195K' },
    { event: 'RBI MPC Meeting', date: 'Dec 08', impact: 'MEDIUM', forecast: '6.50%', previous: '6.50%' },
];

const SECTOR_HEATMAP_DATA = [
    { name: 'IT', value: 2.5 },
    { name: 'Pharma', value: 1.8 },
    { name: 'Auto', value: 0.5 },
    { name: 'Banks', value: -0.8 },
    { name: 'Metals', value: -1.2 },
    { name: 'Realty', value: 1.5 },
    { name: 'FMCG', value: 0.2 },
    { name: 'Energy', value: -0.5 },
];

// Fear & Greed Index Component
const FearGreedGauge: React.FC<{ value: number }> = ({ value }) => {
    const getLabel = (v: number) => {
        if (v <= 25) return { text: 'Extreme Fear', color: '#ef4444' };
        if (v <= 45) return { text: 'Fear', color: '#f97316' };
        if (v <= 55) return { text: 'Neutral', color: '#eab308' };
        if (v <= 75) return { text: 'Greed', color: '#84cc16' };
        return { text: 'Extreme Greed', color: '#22c55e' };
    };

    const { text, color } = getLabel(value);
    const rotation = (value / 100) * 180 - 90; // -90 to 90 degrees

    return (
        <div className="relative flex flex-col items-center">
            <div className="relative w-48 h-24 overflow-hidden">
                {/* Background arc */}
                <div className="absolute inset-0 rounded-t-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-20" />
                <svg viewBox="0 0 200 100" className="w-full h-full">
                    <defs>
                        <linearGradient id="fearGreedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="25%" stopColor="#f97316" />
                            <stop offset="50%" stopColor="#eab308" />
                            <stop offset="75%" stopColor="#84cc16" />
                            <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M 10 100 A 90 90 0 0 1 190 100"
                        fill="none"
                        stroke="url(#fearGreedGradient)"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                    {/* Needle */}
                    <g transform={`rotate(${rotation}, 100, 100)`}>
                        <line x1="100" y1="100" x2="100" y2="25" stroke={color} strokeWidth="3" strokeLinecap="round" />
                        <circle cx="100" cy="100" r="8" fill={color} />
                    </g>
                </svg>
            </div>
            <div className="text-center mt-2">
                <span className="text-3xl font-black" style={{ color }}>{value}</span>
                <p className="text-sm font-bold" style={{ color }}>{text}</p>
            </div>
        </div>
    );
};

// FII/DII Data
const FII_DII_DATA = [
    { date: 'Dec 05', fii: -1250, dii: 1850 },
    { date: 'Dec 04', fii: -890, dii: 1420 },
    { date: 'Dec 03', fii: 520, dii: 780 },
    { date: 'Dec 02', fii: -1580, dii: 2100 },
    { date: 'Nov 29', fii: -2100, dii: 1950 },
];

// Earnings Calendar
const EARNINGS_CALENDAR = [
    { company: 'TCS', ticker: 'TCS', date: 'Dec 09', estimate: '₹62.5', sector: 'IT' },
    { company: 'Infosys', ticker: 'INFY', date: 'Dec 11', estimate: '₹18.2', sector: 'IT' },
    { company: 'HDFC Bank', ticker: 'HDFCBANK', date: 'Dec 15', estimate: '₹21.5', sector: 'Banking' },
    { company: 'Reliance', ticker: 'RELIANCE', date: 'Dec 18', estimate: '₹42.5', sector: 'Energy' },
];



const MacroPulse: React.FC = () => {
    const [macroIndicators, setMacroIndicators] = useState(INITIAL_MACRO_INDICATORS);
    const [globalIndices, setGlobalIndices] = useState(INITIAL_GLOBAL_INDICES);
    const [selectedIndicatorId, setSelectedIndicatorId] = useState(INITIAL_MACRO_INDICATORS[0].id);

    // Live Data Simulation Effect
    useEffect(() => {
        const interval = setInterval(() => {
            // Update Global Indices
            setGlobalIndices(prev => prev.map(idx => {
                const noise = (Math.random() - 0.5) * (idx.value * 0.0005); // 0.05% fluctuation
                const newVal = idx.value + noise;
                const changeDiff = (Math.random() - 0.5) * 0.02;
                return {
                    ...idx,
                    value: newVal,
                    change: parseFloat((idx.change + changeDiff).toFixed(2))
                };
            }));

            // Update Macro Indicators
            setMacroIndicators(prev => prev.map(ind => {
                const noise = (Math.random() - 0.5) * (ind.value * 0.0002);
                const newVal = ind.value + noise;
                // Also update the last data point of the chart for "real-time" feel
                const newData = [...ind.data];
                newData[newData.length - 1] = { ...newData[newData.length - 1], value: newVal };

                return {
                    ...ind,
                    value: parseFloat(newVal.toFixed(2)),
                    data: newData
                };
            }));

        }, 3000); // Update every 3 seconds

        return () => clearInterval(interval);
    }, []);

    const selectedIndicator = useMemo(() =>
        macroIndicators.find(i => i.id === selectedIndicatorId) || macroIndicators[0],
        [macroIndicators, selectedIndicatorId]
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* Global Ticker */}
            <div className="bg-slate-900 border-y border-slate-800 overflow-hidden py-2 -mx-4 md:-mx-8">
                <div className="flex animate-marquee whitespace-nowrap gap-8 px-4">
                    {[...globalIndices, ...globalIndices].map((idx, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm font-mono">
                            <span className="text-slate-400 font-bold">{idx.name}</span>
                            <span className="text-white">
                                {idx.name === 'BITCOIN' ? '$' : ''}
                                {idx.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={idx.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Globe className="text-blue-400" size={28} />
                        Macro Pulse
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Global economic indicators and their impact on your portfolio.
                    </p>
                </div>
            </div>

            {/* Indicators Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {macroIndicators.map((indicator) => (
                    <div
                        key={indicator.id}
                        onClick={() => setSelectedIndicatorId(indicator.id)}
                        className={`bg-white dark:bg-slate-900 border ${selectedIndicatorId === indicator.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                <indicator.icon size={20} />
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${indicator.change >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                                {indicator.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {Math.abs(indicator.change).toFixed(2)}%
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{indicator.label}</p>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                {indicator.id === 'usdinr' || indicator.id === 'crude' || indicator.id === 'gold' ? indicator.unit : ''}
                                {indicator.value.toFixed(2)}
                                {indicator.id === 'us10y' ? indicator.unit : ''}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1 truncate">{indicator.name}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <selectedIndicator.icon size={20} style={{ color: selectedIndicator.color }} />
                                {selectedIndicator.name} Trend
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">{selectedIndicator.desc}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 font-bold uppercase">Current Level</p>
                            <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                                {selectedIndicator.value.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={selectedIndicator.data}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={selectedIndicator.color} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={selectedIndicator.color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                                <XAxis dataKey="day" hide />
                                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={40} />
                                <Tooltip
                                    content={<CustomTooltip formatter={(val: number) => val.toFixed(2)} />}
                                    cursor={{ stroke: selectedIndicator.color, strokeWidth: 1, strokeDasharray: '3 3' }}
                                />
                                <Area
                                    name={selectedIndicator.name}
                                    type="monotone"
                                    dataKey="value"
                                    isAnimationActive={false} // Disable animation for smoother real-time feel
                                    stroke={selectedIndicator.color}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Impact Analysis */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={20} className="text-yellow-400" /> Impact Analysis
                    </h3>
                    <div className="space-y-4">
                        {IMPACT_RULES.filter(rule => rule.condition(macroIndicators)).map((rule, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.impact === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {rule.impact}
                                    </span>
                                    <span className="text-xs text-slate-400">for</span>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {rule.sectors.map(sector => (
                                        <span key={sector} className="text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
                                            {sector}
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2 items-start">
                                    <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {rule.reason}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {IMPACT_RULES.filter(rule => rule.condition(macroIndicators)).length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No major macro alerts currently.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Economic Calendar & Sector Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Economic Calendar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-indigo-500" /> Economic Calendar
                    </h3>
                    <div className="space-y-3">
                        {ECONOMIC_CALENDAR.map((event, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-center justify-center w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{event.date.split(' ')[0]}</span>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{event.date.split(' ')[1]}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{event.event}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold px-1.5 rounded ${event.impact === 'HIGH' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                {event.impact}
                                            </span>
                                            <span className="text-xs text-slate-400">Fcst: {event.forecast}</span>
                                        </div>
                                    </div>
                                </div>
                                <Clock size={16} className="text-slate-400" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sector Heatmap */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart3 size={20} className="text-emerald-500" /> Sector Heatmap (Today)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={SECTOR_HEATMAP_DATA} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#94a3b8' }} width={60} />
                                <Tooltip
                                    content={<CustomTooltip formatter={(val: number) => val.toFixed(2)} />}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="value" name="Performance" radius={[0, 4, 4, 0]} barSize={20}>
                                    {SECTOR_HEATMAP_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* NEW: Fear & Greed, FII/DII, Earnings Calendar Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Fear & Greed Index */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Activity size={20} className="text-orange-400" /> Fear & Greed Index
                    </h3>
                    <FearGreedGauge value={42} />
                    <p className="text-xs text-slate-400 text-center mt-4">
                        Based on VIX, market momentum, and investor behavior
                    </p>
                </div>

                {/* FII/DII Activity */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-500" /> FII/DII Activity (₹ Cr)
                    </h3>
                    <div className="space-y-3">
                        {FII_DII_DATA.map((day, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                                <span className="text-sm text-slate-500 w-16">{day.date}</span>
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-400">FII</p>
                                        <p className={`text-sm font-bold ${day.fii >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {day.fii >= 0 ? '+' : ''}{day.fii}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-400">DII</p>
                                        <p className={`text-sm font-bold ${day.dii >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {day.dii >= 0 ? '+' : ''}{day.dii}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">5-Day Net FII:</span>
                            <span className="font-bold text-rose-500">-5,300 Cr</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-slate-500">5-Day Net DII:</span>
                            <span className="font-bold text-emerald-500">+8,100 Cr</span>
                        </div>
                    </div>
                </div>

                {/* Upcoming Earnings */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-purple-500" /> Earnings Calendar
                    </h3>
                    <div className="space-y-3">
                        {EARNINGS_CALENDAR.map((earning, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{earning.company}</p>
                                    <p className="text-xs text-slate-500">{earning.sector}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{earning.estimate}</p>
                                    <p className="text-xs text-slate-400">{earning.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* IPO Calendar (P2 Enhancement) */}
                <IPOCalendarWidget />
            </div>
        </div>
    );
};

export default MacroPulse;
