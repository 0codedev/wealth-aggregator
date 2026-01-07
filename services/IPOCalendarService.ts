/**
 * IPO Calendar Service
 * Provides mock IPO data and utilities for tracking upcoming IPOs
 * In production, this would integrate with SEBI/NSE APIs
 */

export interface IPOListing {
    id: string;
    name: string;
    symbol?: string;
    issueOpenDate: string;
    issueCloseDate: string;
    listingDate?: string;
    priceRange: { min: number; max: number };
    lotSize: number;
    issueSize: number; // in Crores
    gmp?: number; // Grey Market Premium
    subscriptionData?: {
        qib: number; // times
        nii: number;
        retail: number;
        total: number;
    };
    status: 'UPCOMING' | 'OPEN' | 'CLOSED' | 'LISTED';
    category: 'MAINBOARD' | 'SME';
    sector: string;
    registrar?: string;
    lotValue?: number;
    rating?: 'SUBSCRIBE' | 'AVOID' | 'NEUTRAL';
}

// Mock IPO data (would be fetched from API in production)
const MOCK_IPOS: IPOListing[] = [
    {
        id: 'ipo-1',
        name: 'Zomato Logistics Ltd',
        symbol: 'ZOMLOG',
        issueOpenDate: '2026-01-15',
        issueCloseDate: '2026-01-17',
        listingDate: '2026-01-22',
        priceRange: { min: 145, max: 152 },
        lotSize: 98,
        issueSize: 4500,
        gmp: 45,
        status: 'UPCOMING',
        category: 'MAINBOARD',
        sector: 'Logistics',
        registrar: 'Link Intime',
        rating: 'SUBSCRIBE',
    },
    {
        id: 'ipo-2',
        name: 'TechVenture AI',
        symbol: 'TECHAI',
        issueOpenDate: '2026-01-10',
        issueCloseDate: '2026-01-12',
        listingDate: '2026-01-17',
        priceRange: { min: 520, max: 548 },
        lotSize: 27,
        issueSize: 2200,
        gmp: 85,
        subscriptionData: { qib: 45.2, nii: 28.5, retail: 12.8, total: 28.9 },
        status: 'CLOSED',
        category: 'MAINBOARD',
        sector: 'Technology',
        registrar: 'KFin Tech',
        rating: 'SUBSCRIBE',
    },
    {
        id: 'ipo-3',
        name: 'GreenPower Solutions',
        symbol: 'GREENPWR',
        issueOpenDate: '2026-01-20',
        issueCloseDate: '2026-01-22',
        priceRange: { min: 88, max: 92 },
        lotSize: 162,
        issueSize: 850,
        gmp: 12,
        status: 'UPCOMING',
        category: 'MAINBOARD',
        sector: 'Energy',
        registrar: 'Bigshare Services',
        rating: 'NEUTRAL',
    },
    {
        id: 'ipo-4',
        name: 'QuickMart Retail',
        issueOpenDate: '2026-01-08',
        issueCloseDate: '2026-01-10',
        listingDate: '2026-01-15',
        priceRange: { min: 210, max: 222 },
        lotSize: 67,
        issueSize: 1800,
        gmp: -8,
        subscriptionData: { qib: 5.2, nii: 2.1, retail: 0.8, total: 2.7 },
        status: 'LISTED',
        category: 'MAINBOARD',
        sector: 'Retail',
        registrar: 'Link Intime',
        rating: 'AVOID',
    },
    {
        id: 'ipo-5',
        name: 'NanoTech SME',
        issueOpenDate: '2026-01-12',
        issueCloseDate: '2026-01-14',
        priceRange: { min: 42, max: 45 },
        lotSize: 3000,
        issueSize: 45,
        gmp: 18,
        status: 'OPEN',
        category: 'SME',
        sector: 'Manufacturing',
        registrar: 'Skyline Financial',
        rating: 'SUBSCRIBE',
    },
];

export class IPOCalendarService {
    // Get all IPOs
    async getAllIPOs(): Promise<IPOListing[]> {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        return MOCK_IPOS;
    }

    // Get upcoming IPOs
    async getUpcomingIPOs(): Promise<IPOListing[]> {
        const all = await this.getAllIPOs();
        return all.filter(ipo => ipo.status === 'UPCOMING');
    }

    // Get currently open IPOs
    async getOpenIPOs(): Promise<IPOListing[]> {
        const all = await this.getAllIPOs();
        return all.filter(ipo => ipo.status === 'OPEN');
    }

    // Get IPOs by status
    async getIPOsByStatus(status: IPOListing['status']): Promise<IPOListing[]> {
        const all = await this.getAllIPOs();
        return all.filter(ipo => ipo.status === status);
    }

    // Calculate lot value
    calculateLotValue(ipo: IPOListing): number {
        return ipo.lotSize * ipo.priceRange.max;
    }

    // Calculate expected listing gain
    calculateExpectedGain(ipo: IPOListing): { amount: number; percentage: number } {
        if (!ipo.gmp) return { amount: 0, percentage: 0 };
        const lotValue = this.calculateLotValue(ipo);
        const gainAmount = ipo.gmp * ipo.lotSize;
        const gainPercentage = (ipo.gmp / ipo.priceRange.max) * 100;
        return { amount: gainAmount, percentage: gainPercentage };
    }

    // Get IPO status badge color
    getStatusColor(status: IPOListing['status']): string {
        switch (status) {
            case 'UPCOMING': return '#6366f1'; // Indigo
            case 'OPEN': return '#10b981'; // Emerald
            case 'CLOSED': return '#f59e0b'; // Amber
            case 'LISTED': return '#64748b'; // Slate
            default: return '#64748b';
        }
    }

    // Get rating color
    getRatingColor(rating?: IPOListing['rating']): string {
        switch (rating) {
            case 'SUBSCRIBE': return '#10b981';
            case 'AVOID': return '#ef4444';
            case 'NEUTRAL': return '#f59e0b';
            default: return '#64748b';
        }
    }

    // Calculate days until open/close
    getDaysUntil(dateStr: string): number {
        const target = new Date(dateStr);
        const today = new Date();
        return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
}

export const ipoCalendarService = new IPOCalendarService();
export default IPOCalendarService;
