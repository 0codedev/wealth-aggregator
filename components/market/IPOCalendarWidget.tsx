import React, { useState, useEffect } from 'react';
import {
    Calendar, TrendingUp, TrendingDown, Clock, Zap, AlertCircle,
    ChevronRight, ExternalLink, RefreshCw, Loader2, Target, Building2
} from 'lucide-react';
import { ipoCalendarService, IPOListing } from '../../services/IPOCalendarService';
import { formatCurrency } from '../../utils/helpers';

export const IPOCalendarWidget: React.FC = () => {
    const [ipos, setIPOs] = useState<IPOListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'UPCOMING' | 'OPEN' | 'CLOSED'>('ALL');

    const loadIPOs = async () => {
        setIsLoading(true);
        try {
            const data = await ipoCalendarService.getAllIPOs();
            setIPOs(data);
        } catch (err) {
            console.error('Failed to load IPOs', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadIPOs();
    }, []);

    const filteredIPOs = filter === 'ALL'
        ? ipos
        : ipos.filter(ipo => ipo.status === filter);

    const openCount = ipos.filter(i => i.status === 'OPEN').length;
    const upcomingCount = ipos.filter(i => i.status === 'UPCOMING').length;

    const getStatusStyle = (status: IPOListing['status']) => {
        switch (status) {
            case 'UPCOMING': return 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400';
            case 'OPEN': return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
            case 'CLOSED': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
            case 'LISTED': return 'bg-slate-500/20 text-slate-600 dark:text-slate-400';
            default: return 'bg-slate-500/20 text-slate-500';
        }
    };

    const getRatingStyle = (rating?: IPOListing['rating']) => {
        switch (rating) {
            case 'SUBSCRIBE': return 'bg-emerald-500 text-white';
            case 'AVOID': return 'bg-rose-500 text-white';
            case 'NEUTRAL': return 'bg-amber-500 text-white';
            default: return 'bg-slate-400 text-white';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-500/20 rounded-xl">
                        <Calendar className="text-indigo-600 dark:text-indigo-400" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">IPO Calendar</h3>
                        <p className="text-[10px] text-slate-500">Track upcoming listings</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {openCount > 0 && (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full animate-pulse">
                            {openCount} OPEN
                        </span>
                    )}
                    <button
                        onClick={loadIPOs}
                        disabled={isLoading}
                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
                {(['ALL', 'OPEN', 'UPCOMING', 'CLOSED'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${filter === tab
                                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        {tab}
                        {tab === 'OPEN' && openCount > 0 && (
                            <span className="ml-1 px-1.5 bg-emerald-500 text-white rounded-full">{openCount}</span>
                        )}
                        {tab === 'UPCOMING' && upcomingCount > 0 && (
                            <span className="ml-1 px-1.5 bg-indigo-500 text-white rounded-full">{upcomingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* IPO List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                </div>
            ) : filteredIPOs.length === 0 ? (
                <div className="text-center py-8">
                    <Calendar className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No IPOs in this category</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                    {filteredIPOs.map(ipo => {
                        const lotValue = ipoCalendarService.calculateLotValue(ipo);
                        const gain = ipoCalendarService.calculateExpectedGain(ipo);
                        const daysUntil = ipoCalendarService.getDaysUntil(ipo.issueOpenDate);

                        return (
                            <div
                                key={ipo.id}
                                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                            >
                                {/* Top Row */}
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                                                {ipo.name}
                                            </h4>
                                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${getStatusStyle(ipo.status)}`}>
                                                {ipo.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-500">
                                                {ipo.symbol && <span className="font-mono">{ipo.symbol}</span>}
                                            </span>
                                            <span className="text-[10px] text-slate-400">•</span>
                                            <span className="text-[10px] text-slate-500">{ipo.sector}</span>
                                            <span className={`px-1 py-0.5 text-[8px] font-bold rounded ${ipo.category === 'SME' ? 'bg-purple-500/20 text-purple-600' : 'bg-blue-500/20 text-blue-600'
                                                }`}>
                                                {ipo.category}
                                            </span>
                                        </div>
                                    </div>
                                    {ipo.rating && (
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${getRatingStyle(ipo.rating)}`}>
                                            {ipo.rating}
                                        </span>
                                    )}
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-4 gap-2 text-[10px] mb-2">
                                    <div>
                                        <p className="text-slate-400 mb-0.5">Price Range</p>
                                        <p className="font-bold text-slate-700 dark:text-white">
                                            ₹{ipo.priceRange.min}-{ipo.priceRange.max}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 mb-0.5">Lot Value</p>
                                        <p className="font-bold text-slate-700 dark:text-white">
                                            {formatCurrency(lotValue)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 mb-0.5">Issue Size</p>
                                        <p className="font-bold text-slate-700 dark:text-white">
                                            ₹{ipo.issueSize} Cr
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 mb-0.5">GMP</p>
                                        <p className={`font-bold ${ipo.gmp && ipo.gmp > 0 ? 'text-emerald-600' : ipo.gmp && ipo.gmp < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                            {ipo.gmp !== undefined ? (
                                                <>
                                                    {ipo.gmp > 0 ? '+' : ''}₹{ipo.gmp}
                                                    <span className="text-[8px] ml-0.5">
                                                        ({gain.percentage.toFixed(1)}%)
                                                    </span>
                                                </>
                                            ) : '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* Subscription Data (if closed) */}
                                {ipo.subscriptionData && (
                                    <div className="grid grid-cols-4 gap-2 text-[10px] p-2 bg-slate-100 dark:bg-slate-800 rounded-lg mb-2">
                                        <div>
                                            <p className="text-slate-400">QIB</p>
                                            <p className="font-bold text-indigo-600">{ipo.subscriptionData.qib}x</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400">NII</p>
                                            <p className="font-bold text-purple-600">{ipo.subscriptionData.nii}x</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400">Retail</p>
                                            <p className="font-bold text-cyan-600">{ipo.subscriptionData.retail}x</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400">Total</p>
                                            <p className={`font-bold ${ipo.subscriptionData.total > 10 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                {ipo.subscriptionData.total}x
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Dates */}
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Clock size={10} />
                                        {ipo.issueOpenDate} - {ipo.issueCloseDate}
                                    </span>
                                    {ipo.status === 'UPCOMING' && daysUntil > 0 && (
                                        <span className="flex items-center gap-1 text-indigo-500 font-bold">
                                            <Zap size={10} />
                                            Opens in {daysUntil}d
                                        </span>
                                    )}
                                    {ipo.listingDate && (
                                        <span className="flex items-center gap-1">
                                            <Target size={10} />
                                            Lists: {ipo.listingDate}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <p className="text-[10px] text-slate-400">
                    Data refreshed from mock API • Real-time coming soon
                </p>
                <button className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 font-bold">
                    View All <ChevronRight size={12} />
                </button>
            </div>
        </div>
    );
};

export default IPOCalendarWidget;
