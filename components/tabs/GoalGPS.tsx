import React, { useState, useMemo } from 'react';
import {
    Target, Compass, TrendingUp, AlertCircle,
    Settings, RefreshCw, CheckCircle2, XCircle,
    Shield, Zap, Gauge, Scale, Table, Download,
    ArrowUpRight, ArrowDownRight, Plus
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line
} from 'recharts';
import { CustomTooltip } from '../../components/shared/CustomTooltip';

import OracleHub from '../dashboard/hubs/OracleHub';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useGoals } from '../../hooks/useGoals';
import { GoalCard } from '../goals/GoalCard';
import { AddGoalModal } from '../goals/AddGoalModal';

// Helper function defined locally to avoid circular dependency with App.tsx
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value);
};

const GoalGPS: React.FC = () => {
    // --- GLOBAL STATE ---
    const { stats } = usePortfolio();

    // --- STATE ---
    const [targetAmount, setTargetAmount] = useState(50000000); // 5 Cr
    const [targetYear, setTargetYear] = useState(2035);
    const [currentWealth, setCurrentWealth] = useState(stats?.totalCurrent || 2500000); // Default or actual
    const [monthlySip, setMonthlySip] = useState(50000);
    const [inflationRate, setInflationRate] = useState(6);
    const [isInflationAdjusted, setIsInflationAdjusted] = useState(false);
    const [riskProfile, setRiskProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
    const [showTable, setShowTable] = useState(false);
    const [scenario, setScenario] = useState<'base' | 'bear' | 'bull'>('base');

    // Multi-Goal Tracking (P1 Enhancement)
    const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
    const { goals, addGoal, updateGoal, deleteGoal, completeGoal, getGoalProgress, getTotalProgress } = useGoals();

    // Sync current wealth with portfolio stats when available
    React.useEffect(() => {
        if (stats?.totalCurrent) {
            setCurrentWealth(stats.totalCurrent);
        }
    }, [stats?.totalCurrent]);

    // --- RISK PROFILES ---
    const RISK_PARAMS = {
        conservative: { mean: 0.08, stdDev: 0.05, label: 'Conservative', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500' },
        balanced: { mean: 0.12, stdDev: 0.12, label: 'Balanced', icon: Scale, color: 'text-blue-500', bg: 'bg-blue-500' },
        aggressive: { mean: 0.15, stdDev: 0.20, label: 'Aggressive', icon: Zap, color: 'text-rose-500', bg: 'bg-rose-500' }
    };

    // --- MONTE CARLO ENGINE ---
    const simulationData = useMemo(() => {
        const years = targetYear - new Date().getFullYear();
        if (years <= 0) return null;

        const simulations = 1000;
        const results: number[][] = [];

        // Market Assumptions based on Risk Profile & Scenario
        let { mean, stdDev } = RISK_PARAMS[riskProfile];

        if (scenario === 'bear') { mean -= 0.04; stdDev += 0.05; } // Crash scenario
        if (scenario === 'bull') { mean += 0.04; stdDev -= 0.02; } // Boom scenario

        // Run Simulations
        for (let s = 0; s < simulations; s++) {
            let wealth = currentWealth;
            const path = [wealth];

            for (let m = 1; m <= years * 12; m++) {
                // Geometric Brownian Motion for Monthly Returns
                const randomShock = (Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() - 3) / Math.sqrt(0.5); // Approx Gaussian
                const monthlyReturn = (mean / 12) + (stdDev / Math.sqrt(12)) * randomShock;

                wealth = wealth * (1 + monthlyReturn) + monthlySip;

                if (m % 12 === 0) {
                    // Adjust for Inflation if toggled
                    const realWealth = isInflationAdjusted
                        ? wealth / Math.pow(1 + inflationRate / 100, m / 12)
                        : wealth;
                    path.push(realWealth);
                }
            }
            results.push(path);
        }

        // Calculate Percentiles (10th, 50th, 90th)
        const chartData = [];
        const finalValues = [];

        for (let y = 0; y <= years; y++) {
            const yearValues = results.map(r => r[y]).sort((a, b) => a - b);
            const p10 = yearValues[Math.floor(simulations * 0.1)];
            const p50 = yearValues[Math.floor(simulations * 0.5)];
            const p90 = yearValues[Math.floor(simulations * 0.9)];

            chartData.push({
                year: new Date().getFullYear() + y,
                p10,
                p50,
                p90,
                target: isInflationAdjusted ? targetAmount / Math.pow(1 + inflationRate / 100, y) : targetAmount
            });

            if (y === years) finalValues.push(...yearValues);
        }

        // Success Probability
        const targetVal = isInflationAdjusted ? targetAmount / Math.pow(1 + inflationRate / 100, years) : targetAmount;
        const successCount = finalValues.filter(v => v >= targetVal).length;
        const probability = (successCount / simulations) * 100;

        // Smart Suggestions
        const suggestions = [];
        if (probability < 50) {
            const shortfall = targetVal - chartData[chartData.length - 1].p50;
            const extraSip = Math.round((shortfall / (years * 12)) * 0.6); // Rough heuristic
            suggestions.push({
                icon: TrendingUp,
                text: `Increase monthly SIP by ${formatCurrency(extraSip)} to improve odds.`,
                type: 'critical'
            });
            if (riskProfile === 'conservative') {
                suggestions.push({
                    icon: Gauge,
                    text: "Consider moving to a Balanced profile for higher potential returns.",
                    type: 'warning'
                });
            }
        } else if (probability < 80) {
            suggestions.push({
                icon: AlertCircle,
                text: "You are on track, but a 10% step-up in SIP next year would secure it.",
                type: 'info'
            });
        } else {
            suggestions.push({
                icon: CheckCircle2,
                text: "Excellent Plan! You are highly likely to exceed your target.",
                type: 'success'
            });
        }

        return { chartData, probability, medianOutcome: chartData[chartData.length - 1].p50, suggestions };
    }, [targetAmount, targetYear, currentWealth, monthlySip, inflationRate, isInflationAdjusted, riskProfile, scenario]);

    if (!simulationData) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Compass className="text-emerald-400" size={28} />
                        Goal GPS
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Probabilistic Wealth Planning using Monte Carlo Simulations.
                    </p>
                </div>
            </div>

            {/* ORACLE 2.0 HUB MOVED HERE */}
            <OracleHub totalPortfolioValue={stats?.totalCurrent || 0} />

            {/* Multi-Goal Tracking Section (P1 Enhancement) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="text-indigo-500" size={20} />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">My Financial Goals</h3>
                        {goals.length > 0 && (
                            <span className="text-xs font-bold text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-full">
                                {getTotalProgress().toFixed(0)}% Overall
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsAddGoalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/30"
                    >
                        <Plus size={16} />
                        Add Goal
                    </button>
                </div>

                {goals.length === 0 ? (
                    <div className="text-center py-12">
                        <Target className="mx-auto text-slate-300 dark:text-slate-700 mb-4" size={48} />
                        <p className="text-slate-500 font-bold">No goals yet</p>
                        <p className="text-sm text-slate-400 mt-1">Create your first financial goal to track progress</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {goals.filter(g => !g.completedAt).map(goal => (
                            <GoalCard
                                key={goal.id}
                                goal={goal}
                                progress={getGoalProgress(goal)}
                                onUpdate={updateGoal}
                                onDelete={deleteGoal}
                                onComplete={completeGoal}
                            />
                        ))}
                    </div>
                )}

                {/* Completed Goals Section */}
                {goals.filter(g => g.completedAt).length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-3">🏆 Completed Goals</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {goals.filter(g => g.completedAt).map(goal => (
                                <GoalCard
                                    key={goal.id}
                                    goal={goal}
                                    progress={100}
                                    onUpdate={updateGoal}
                                    onDelete={deleteGoal}
                                    onComplete={completeGoal}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Goal Modal */}
            <AddGoalModal
                isOpen={isAddGoalOpen}
                onClose={() => setIsAddGoalOpen(false)}
                onAdd={addGoal}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Configuration Panel */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-fit">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Settings size={20} className="text-slate-400" /> Flight Plan
                    </h3>

                    <div className="space-y-5">
                        {/* Risk Profile Selector */}
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Risk Profile</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['conservative', 'balanced', 'aggressive'] as const).map((profile) => (
                                    <button
                                        key={profile}
                                        onClick={() => setRiskProfile(profile)}
                                        className={`p-2 rounded-lg border text-xs font-bold transition-all ${riskProfile === profile ? `bg-slate-800 text-white border-slate-700` : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-transparent hover:bg-slate-100'}`}
                                    >
                                        {profile.charAt(0).toUpperCase() + profile.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase">Target Amount</label>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 mt-1">
                                <span className="text-slate-400">₹</span>
                                <input
                                    type="number"
                                    value={targetAmount}
                                    onChange={(e) => setTargetAmount(Number(e.target.value))}
                                    className="bg-transparent w-full outline-none font-mono font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase">Target Year</label>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 mt-1">
                                <Target size={16} className="text-slate-400" />
                                <input
                                    type="number"
                                    value={targetYear}
                                    onChange={(e) => setTargetYear(Number(e.target.value))}
                                    className="bg-transparent w-full outline-none font-mono font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase">Current Wealth</label>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 mt-1">
                                <span className="text-slate-400">₹</span>
                                <input
                                    type="number"
                                    value={currentWealth}
                                    onChange={(e) => setCurrentWealth(Number(e.target.value))}
                                    className="bg-transparent w-full outline-none font-mono font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase">Monthly SIP</label>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 mt-1">
                                <span className="text-slate-400">₹</span>
                                <input
                                    type="number"
                                    value={monthlySip}
                                    onChange={(e) => setMonthlySip(Number(e.target.value))}
                                    className="bg-transparent w-full outline-none font-mono font-bold text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Adjust for Inflation ({inflationRate}%)</span>
                                <button
                                    onClick={() => setIsInflationAdjusted(!isInflationAdjusted)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${isInflationAdjusted ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isInflationAdjusted ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                {isInflationAdjusted
                                    ? "Showing 'Real' value (Purchasing Power)."
                                    : "Showing 'Nominal' value (Paper Money)."
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Simulation Chart */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Probability Score Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-6 rounded-2xl border flex items-center gap-4 ${simulationData.probability > 75 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30' : simulationData.probability > 50 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30'}`}>
                            <div className={`p-3 rounded-full ${simulationData.probability > 75 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : simulationData.probability > 50 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'}`}>
                                {simulationData.probability > 75 ? <CheckCircle2 size={32} /> : simulationData.probability > 50 ? <AlertCircle size={32} /> : <XCircle size={32} />}
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase opacity-70">Success Probability</p>
                                <h3 className="text-3xl font-black">
                                    {simulationData.probability.toFixed(1)}%
                                </h3>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                            <p className="text-xs text-slate-500 font-bold uppercase">Median Outcome (50th %)</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                {formatCurrency(simulationData.medianOutcome)}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                vs Target: {formatCurrency(targetAmount)}
                            </p>
                        </div>
                    </div>

                    {/* The Cone Chart */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <TrendingUp size={20} className="text-indigo-500" /> Cone of Uncertainty
                            </h3>

                            {/* Scenario Toggles */}
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button onClick={() => setScenario('bear')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${scenario === 'bear' ? 'bg-white dark:bg-slate-700 text-rose-500 shadow-sm' : 'text-slate-500'}`}>Bear</button>
                                <button onClick={() => setScenario('base')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${scenario === 'base' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-500'}`}>Base</button>
                                <button onClick={() => setScenario('bull')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${scenario === 'bull' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-500'}`}>Bull</button>
                            </div>
                        </div>

                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={simulationData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="coneGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.1} />
                                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                                    <YAxis tickFormatter={(val) => `${val / 10000000}Cr`} tick={{ fontSize: 10 }} width={40} />
                                    <Tooltip
                                        content={<CustomTooltip />}
                                        cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '3 3' }}
                                    />

                                    {/* The Cone: Area between p10 and p90 using Gradient */}
                                    <Area
                                        type="monotone"
                                        dataKey="p90"
                                        stroke="#6366f1"
                                        strokeWidth={1}
                                        strokeDasharray="5 5"
                                        fill="url(#coneGradient)"
                                        name="Optimistic (90%)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="p10"
                                        stroke="#6366f1"
                                        strokeWidth={1}
                                        strokeDasharray="5 5"
                                        fill="#fff"
                                        fillOpacity={0} // Invisible fill, just outline
                                        name="Pessimistic (10%)"
                                    />

                                    {/* Dotted Bounds */}
                                    <Line type="monotone" dataKey="p90" stroke="#818cf8" strokeWidth={1} strokeDasharray="3 3" dot={false} strokeOpacity={0.5} activeDot={false} />
                                    <Line type="monotone" dataKey="p10" stroke="#818cf8" strokeWidth={1} strokeDasharray="3 3" dot={false} strokeOpacity={0.5} activeDot={false} />

                                    {/* Median Line */}
                                    <Line
                                        type="monotone"
                                        dataKey="p50"
                                        stroke="#4f46e5"
                                        strokeWidth={3}
                                        dot={false}
                                        name="Median (50%)"
                                    />

                                    {/* Target Line */}
                                    <ReferenceLine y={isInflationAdjusted ? targetAmount / Math.pow(1 + inflationRate / 100, simulationData.chartData.length) : targetAmount} stroke="#ef4444" strokeDasharray="3 3" label="Target" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 mt-4 text-xs font-bold text-slate-500">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-indigo-500/30 border border-indigo-400 rounded-sm"></span>
                                90% Likely Range
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-1 bg-indigo-600 rounded-full"></span>
                                Median Path
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-0.5 border-t border-dashed border-rose-500"></span>
                                Target
                            </div>
                        </div>
                    </div>

                    {/* Smart Suggestions */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Zap size={20} className="text-yellow-400" /> AI Suggestions
                        </h3>
                        <div className="space-y-3">
                            {simulationData.suggestions.map((suggestion, idx) => (
                                <div key={idx} className={`flex items-start gap-3 p-4 rounded-xl border ${suggestion.type === 'critical' ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : suggestion.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
                                    <suggestion.icon size={20} className="shrink-0 mt-0.5" />
                                    <p className="text-sm font-medium">{suggestion.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detailed Cashflow Table Toggle */}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                        <button
                            onClick={() => setShowTable(!showTable)}
                            className="flex items-center gap-2 text-sm font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                        >
                            <Table size={16} />
                            {showTable ? "Hide Detailed Cashflows" : "Show Detailed Cashflows"}
                        </button>

                        {showTable && (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Year</th>
                                            <th className="px-4 py-3">Pessimistic (10%)</th>
                                            <th className="px-4 py-3">Median (50%)</th>
                                            <th className="px-4 py-3 rounded-r-lg">Optimistic (90%)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {simulationData.chartData.filter((_, i) => i % 2 === 0).map((row) => (
                                            <tr key={row.year} className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.year}</td>
                                                <td className="px-4 py-3 text-rose-500">{formatCurrency(row.p10)}</td>
                                                <td className="px-4 py-3 text-indigo-500 font-bold">{formatCurrency(row.p50)}</td>
                                                <td className="px-4 py-3 text-emerald-500">{formatCurrency(row.p90)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoalGPS;
