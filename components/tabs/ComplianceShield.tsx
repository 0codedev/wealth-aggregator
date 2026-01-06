
import React, { useState, useEffect, useMemo } from 'react';
import { Investment, InvestmentType } from '../../types';
import {
    ShieldCheck, CalendarClock, TrendingDown, Coins, Lock,
    AlertTriangle, ArrowRight, IndianRupee, Info, CheckCircle2,
    PieChart as PieChartIcon, RefreshCw, Calculator, Scissors, Banknote,
    ChevronLeft, ChevronRight, Gavel, Percent, Skull
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts';
import { CustomTooltip } from '../shared/CustomTooltip';
import { formatCurrency } from '../../utils/helpers';
import DividendTracker from '../DividendTracker';
import { useFiscalYear } from '../../hooks/useFiscalYear';
import { db, Trade } from '../../database';
import { motion, AnimatePresence } from 'framer-motion';
import AuditLog from '../AuditLog';
import { ITRPreFillPanel } from '../compliance/ITRPreFillPanel';

interface ComplianceShieldProps {
    investments: Investment[];
}

const LTCG_LIMIT = 125000; // New ₹1.25L Limit for FY 24-25
const TAX_RATE = 0.125; // 12.5% LTCG Rate

const CircularProgress = ({ value, max, size = 60, strokeWidth = 4, color = "text-indigo-500" }: any) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (Math.min(value / max, 1) * circumference);

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90 w-full h-full">
                <circle
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={`${color} transition-all duration-1000 ease-out`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] font-bold">
                {value >= max ? <CheckCircle2 size={16} className={color} /> : <span>{Math.round((value / max) * 100)}%</span>}
            </div>
        </div>
    );
};

const ComplianceShield: React.FC<ComplianceShieldProps> = ({ investments }) => {
    // Use Fiscal Engine
    const { startDate, endDate, label, prevYear, nextYear, offset } = useFiscalYear();

    // State for realized gain tracking (Now DB backed)
    const [realizedLTCG, setRealizedLTCG] = useState(0);
    const [isEditingTax, setIsEditingTax] = useState(false);
    const [tempTaxVal, setTempTaxVal] = useState('');

    // Wash Sale State
    const [washSaleWarnings, setWashSaleWarnings] = useState<{ ticker: string, lossDate: string, lossAmount: number }[]>([]);

    // Load Tax Record from DB when FY changes
    useEffect(() => {
        const loadTaxRecord = async () => {
            try {
                const record = await db.tax_records.where('fy').equals(label).first();
                if (record) {
                    setRealizedLTCG(record.realizedLTCG);
                    setTempTaxVal(record.realizedLTCG.toString());
                } else {
                    setRealizedLTCG(0);
                    setTempTaxVal('');
                }
            } catch (e) {
                console.error("Failed to load tax record", e);
            }
        };
        loadTaxRecord();
    }, [label]);

    // Wash Sale Detection Logic
    useEffect(() => {
        const detectWashSales = async () => {
            const trades = await db.trades.toArray();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const warnings: { ticker: string, lossDate: string, lossAmount: number }[] = [];

            // 1. Find recent losses
            const recentLosses = trades.filter(t => (t.pnl || 0) < 0 && new Date(t.date) >= thirtyDaysAgo);

            // 2. Check if we currently hold them
            recentLosses.forEach(lossTrade => {
                const isHolding = investments.some(inv =>
                    inv.name.toUpperCase().includes(lossTrade.ticker.toUpperCase()) ||
                    lossTrade.ticker.toUpperCase().includes(inv.name.toUpperCase())
                );

                if (isHolding) {
                    warnings.push({
                        ticker: lossTrade.ticker,
                        lossDate: lossTrade.date,
                        lossAmount: Math.abs(lossTrade.pnl || 0)
                    });
                }
            });
            setWashSaleWarnings(warnings);
        };
        detectWashSales();
    }, [investments]);

    const saveTax = async () => {
        const val = parseFloat(tempTaxVal) || 0;
        setRealizedLTCG(val);
        setIsEditingTax(false);

        try {
            const existing = await db.tax_records.where('fy').equals(label).first();
            if (existing) {
                await db.tax_records.update(existing.id!, {
                    realizedLTCG: val,
                    lastUpdated: new Date().toISOString()
                });
            } else {
                await db.tax_records.add({
                    fy: label,
                    realizedLTCG: val,
                    realizedSTCG: 0,
                    lastUpdated: new Date().toISOString()
                });
            }
        } catch (e) {
            console.error("Failed to save tax record", e);
        }
    };

    // Logic: Dates & FY
    const today = new Date();
    const daysToDeadline = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Logic: Harvesting Candidates & Action Card
    const taxableExcess = Math.max(0, realizedLTCG - LTCG_LIMIT);
    const estimatedTaxLiability = taxableExcess * TAX_RATE;

    const harvestAction = useMemo(() => {
        // Find assets with unrealized losses
        const losers = investments
            .filter(inv => (inv.currentValue - inv.investedAmount) < -500) // Minimum loss threshold
            .map(inv => {
                const totalLoss = Math.abs(inv.currentValue - inv.investedAmount);
                const lossPct = (totalLoss / inv.investedAmount);

                let targetLossToBook = taxableExcess > 0 ? taxableExcess : totalLoss;
                targetLossToBook = Math.min(targetLossToBook, totalLoss);

                const sellRatio = targetLossToBook / totalLoss;
                const sellValue = inv.currentValue * sellRatio;
                const taxSaved = targetLossToBook * TAX_RATE;

                return {
                    ...inv,
                    totalLoss,
                    targetLossToBook,
                    sellValue,
                    taxSaved,
                    isFullExit: sellRatio > 0.99
                };
            })
            .sort((a, b) => b.taxSaved - a.taxSaved);

        // Find a "Pair" (Gain to offset)
        const winner = investments
            .filter(inv => (inv.currentValue - inv.investedAmount) > 1000)
            .sort((a, b) => (b.currentValue - b.investedAmount) - (a.currentValue - a.investedAmount))[0];

        return losers.length > 0 ? { ...losers[0], pair: winner } : null;
    }, [investments, taxableExcess]);

    // Logic: STT Eater (The Government's Share)
    const sttStats = useMemo(() => {
        const totalPortfolioValue = investments.reduce((acc, curr) => acc + curr.currentValue, 0);
        const totalUnrealizedProfit = investments.reduce((acc, curr) => acc + (curr.currentValue - curr.investedAmount), 0);

        // Assumptions for Liquidation Scenario
        const estimatedSTT = totalPortfolioValue * 0.001; // 0.1% STT on Delivery Sell
        const estimatedExchCharges = totalPortfolioValue * 0.0005; // ~0.05% Exchange + Stamp + GST
        // Rough Tax Estimate (Assuming mixed bag, flat 12.5% on profits > 1L)
        const taxableProfit = Math.max(0, totalUnrealizedProfit - 100000);
        const estimatedTax = taxableProfit * 0.125;

        const govtShare = estimatedSTT + estimatedExchCharges + estimatedTax;
        const netProfit = Math.max(0, totalUnrealizedProfit - govtShare);

        return {
            totalUnrealizedProfit,
            govtShare,
            netProfit,
            breakdown: [
                { name: 'Your Profit', value: netProfit, color: '#10b981' },
                { name: 'Govt Share', value: govtShare, color: '#f43f5e' }
            ]
        };
    }, [investments]);

    // Logic: Holding Periods
    const calculateDaysHeld = (dateStr: string) => {
        const purchaseDate = new Date(dateStr);
        const diff = Math.abs(today.getTime() - purchaseDate.getTime());
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const equityAssets = investments.filter(i =>
        [InvestmentType.STOCKS, InvestmentType.MUTUAL_FUND, InvestmentType.ETF, InvestmentType.SMALLCASE].includes(i.type)
    );

    const bullionAssets = investments.filter(i =>
        [InvestmentType.DIGITAL_GOLD, InvestmentType.DIGITAL_SILVER].includes(i.type)
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20 md:pb-0">

            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <ShieldCheck className="text-emerald-400" size={28} />
                            Compliance Shield
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-400">Tax Harvesting & Regulatory Rule Engine • </span>
                            {/* FY Switcher */}
                            <div className="inline-flex items-center gap-1 bg-slate-800 rounded-lg px-1 py-0.5 border border-slate-700">
                                <button onClick={prevYear} className="p-1 hover:text-white text-slate-400 transition-colors"><ChevronLeft size={12} /></button>
                                <span className="text-indigo-400 font-mono text-xs font-bold">{label}</span>
                                <button onClick={nextYear} disabled={offset >= 0} className={`p-1 transition-colors ${offset >= 0 ? 'text-slate-700 cursor-not-allowed' : 'hover:text-white text-slate-400'}`}><ChevronRight size={12} /></button>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                            <CalendarClock size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Tax Deadline</p>
                            <p className="text-lg font-mono font-bold text-white">
                                {offset === 0 ? `${daysToDeadline} Days Left` : offset < 0 ? 'Closed' : 'Future'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ITR Pre-Fill Generator (P2 Enhancement) */}
            <ITRPreFillPanel />

            {/* ALERTS SECTION: Wash Sale & STT Eater */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. STT Eater (The Government's Share) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Skull size={100} className="text-rose-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Percent size={18} className="text-rose-500" /> The Tax Bite
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Liquidation Scenario: What you keep vs. What they take.</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 md:w-32 md:h-32 relative shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sttStats.breakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={25}
                                        outerRadius={40}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {sttStats.breakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'none' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Net Profit</span>
                                <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(sttStats.netProfit)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Govt Share</span>
                                <span className="font-bold text-rose-500">-{formatCurrency(sttStats.govtShare)}</span>
                            </div>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                            <p className="text-[10px] text-slate-400 italic">Includes STT, Exchange Charges, Stamp Duty & Est. Tax.</p>
                        </div>
                    </div>
                </div>

                {/* 2. Wash Sale Detector */}
                <div className={`rounded-2xl p-6 border shadow-sm relative overflow-hidden flex flex-col ${washSaleWarnings.length > 0 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Gavel size={100} className={washSaleWarnings.length > 0 ? "text-amber-500" : "text-slate-400"} />
                    </div>

                    <div>
                        <h3 className={`font-bold flex items-center gap-2 ${washSaleWarnings.length > 0 ? 'text-amber-700 dark:text-amber-500' : 'text-slate-800 dark:text-white'}`}>
                            <Gavel size={18} /> Wash Sale Detector
                        </h3>
                        <p className={`text-xs mb-4 ${washSaleWarnings.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                            Monitoring disallowed loss claims.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[120px] md:max-h-[200px] pr-2">
                        {washSaleWarnings.length > 0 ? (
                            <div className="space-y-2">
                                {washSaleWarnings.map((w, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 flex justify-between items-center animate-in slide-in-from-bottom-2">
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{w.ticker}</p>
                                            <p className="text-[10px] text-slate-500">Sold loss on {w.lossDate}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">
                                                Re-Entry Risk
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                                <p className="text-sm text-slate-500">No wash sale risks detected.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TOP ROW: TAX BAR & ACTION CARD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. TAX BAR (Realized Gain Monitor) */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Calculator size={18} className="text-indigo-500" /> LTCG Exemption
                            </h3>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">
                                Limit: {formatCurrency(LTCG_LIMIT)}
                            </span>
                        </div>

                        <div className="relative pt-2 pb-6">
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-slate-500">Used</span>
                                <span className={`${realizedLTCG > LTCG_LIMIT ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {Math.min((realizedLTCG / LTCG_LIMIT) * 100, 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${realizedLTCG > LTCG_LIMIT ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
                                    style={{ width: `${Math.min((realizedLTCG / LTCG_LIMIT) * 100, 100)}%` }}
                                ></div>
                            </div>
                            {realizedLTCG > LTCG_LIMIT ? (
                                <p className="text-[10px] text-rose-500 mt-2 font-medium flex items-center gap-1">
                                    <AlertTriangle size={12} /> Taxable Excess: {formatCurrency(taxableExcess)}
                                </p>
                            ) : (
                                <p className="text-[10px] text-emerald-500 mt-2 font-medium flex items-center gap-1">
                                    <CheckCircle2 size={12} /> {formatCurrency(LTCG_LIMIT - realizedLTCG)} remaining tax-free.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Realized Gains (Manual)</p>
                        {isEditingTax ? (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={tempTaxVal}
                                    onChange={(e) => setTempTaxVal(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-sm outline-none"
                                    autoFocus
                                />
                                <button onClick={saveTax} className="bg-indigo-600 text-white px-3 rounded text-xs font-bold">Save</button>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center group cursor-pointer" onClick={() => setIsEditingTax(true)}>
                                <span className="text-xl font-mono font-bold text-slate-900 dark:text-white border-b border-dashed border-slate-300 dark:border-slate-700">
                                    {formatCurrency(realizedLTCG)}
                                </span>
                                <div className="p-1.5 bg-white dark:bg-slate-800 rounded text-slate-400 group-hover:text-indigo-500 transition-colors">
                                    <RefreshCw size={14} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. ACTION CARD (Harvesting Sniper) */}
                <div className="lg:col-span-2">
                    {harvestAction ? (
                        <div className="h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 rounded-2xl p-1 border border-indigo-500/30 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Scissors size={140} className="text-white" />
                            </div>

                            <div className="h-full bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 flex flex-col justify-between relative z-10">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                                Priority Action
                                            </span>
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                Tax Harvesting Pair
                                            </h3>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            {taxableExcess > 0
                                                ? "Offset your taxable gains immediately to reduce liability."
                                                : "Harvest losses now to carry forward and offset future gains."}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-indigo-300 uppercase mb-1">Potential Tax Saved</p>
                                        <p className="text-3xl font-black text-emerald-400 tracking-tight">
                                            {formatCurrency(harvestAction.taxSaved)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
                                    <div className="flex-1 w-full">
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-2">Sell Candidate (Loss)</p>
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-rose-500/20 rounded-lg text-rose-400">
                                                <TrendingDown size={24} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-lg leading-none">{harvestAction.name}</p>
                                                <p className="text-xs text-rose-300 mt-1">Unrealized Loss: -{formatCurrency(harvestAction.totalLoss)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {harvestAction.pair && (
                                        <>
                                            <div className="hidden md:flex flex-col items-center justify-center text-slate-500">
                                                <ArrowRight size={24} />
                                                <span className="text-[10px] uppercase font-bold">Offsets</span>
                                            </div>

                                            <div className="flex-1 w-full">
                                                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Offset Target (Gain)</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400">
                                                        <IndianRupee size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-lg leading-none">{harvestAction.pair.name}</p>
                                                        <p className="text-xs text-emerald-300 mt-1">Unrealized Gain: +{formatCurrency(harvestAction.pair.currentValue - harvestAction.pair.investedAmount)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="mt-4 flex gap-3">
                                    <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2">
                                        <Scissors size={18} /> Execute Harvest
                                    </button>
                                    <div className="px-4 py-3 bg-slate-800 rounded-xl text-xs text-slate-400 flex items-center">
                                        Book loss: <span className="text-rose-400 font-bold ml-1">-{formatCurrency(harvestAction.targetLossToBook)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Tax Efficient</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xs">
                                No significant loss-making assets found for harvesting. Your portfolio is currently optimized.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. AUDIT LOG & DIVIDENDS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AuditLog />
                <DividendTracker />
            </div>

            {/* 3. VISUAL COUNTDOWNS (HOLDING PERIODS) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Equity Ring List */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                            <Coins size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">Equity & ETFs</h3>
                            <p className="text-xs text-slate-500">LTCG Maturity: 12 Months</p>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {equityAssets.map(inv => {
                            const days = calculateDaysHeld(inv.lastUpdated);
                            const isMature = days >= 365;
                            return (
                                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <CircularProgress value={days} max={365} size={48} color={isMature ? "text-emerald-500" : "text-cyan-500"} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{inv.name}</p>
                                            <p className="text-xs text-slate-500 font-mono">
                                                {isMature ? 'Long Term Capital Asset' : `${365 - days} days to LTCG`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Invested</p>
                                        <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">{formatCurrency(inv.investedAmount)}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {equityAssets.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">No Equity assets.</p>}
                    </div>
                </div>

                {/* Bullion Ring List */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                            <Lock size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">Digital Gold</h3>
                            <p className="text-xs text-slate-500">LTCG Maturity: 24 Months</p>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {bullionAssets.map(inv => {
                            const days = calculateDaysHeld(inv.lastUpdated);
                            const isMature = days >= 730;
                            return (
                                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                                    <div className="flex items-center gap-3 overflow-hidden relative z-10">
                                        <CircularProgress value={days} max={730} size={48} color={isMature ? "text-emerald-500" : "text-amber-500"} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{inv.name}</p>
                                            <p className="text-xs text-slate-500 font-mono">
                                                {isMature ? 'Safe to withdraw' : 'Slab Rate Risk!'}
                                            </p>
                                        </div>
                                    </div>
                                    {!isMature && (
                                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none"></div>
                                    )}
                                </div>
                            );
                        })}
                        {bullionAssets.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">No Gold assets.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComplianceShield;
