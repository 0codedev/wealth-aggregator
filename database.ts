import Dexie, { type Table } from 'dexie';
import { Investment, HistoryEntry } from './types';

export type TradeDirection = 'Long' | 'Short';
export type MoodEntry = 'Focused' | 'Anxious' | 'Bored' | 'Revenge' | 'Greedy';
export type MoodExit = 'Satisfied' | 'Panic' | 'Regret' | 'Euphoric';
export type TradeMistake = 'FOMO' | 'Chasing' | 'No Stop Loss' | 'Overleveraged' | 'Early Exit' | 'Hesitation' | 'Revenge Trade' | 'News Trading';
// Changed to string to allow dynamic strategies
export type TradeSetup = string;
export type SetupGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface TradeScreenshot {
  id: string;
  filename: string;
  blob: Blob;
  annotations?: any[]; // Drawing data
  uploadedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  mandatory?: boolean;
}

export interface EmotionLog {
  primary: string;
  intensity: number; // 1-5
  notes?: string;
}

export interface Trade {
  id?: number;
  ticker: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  quantity: number;
  direction: TradeDirection;
  date: string; // ISO string
  entryTime?: string; // HH:mm format (Module 4)
  moodEntry: MoodEntry;
  moodExit: MoodExit;
  mistakes: string[];
  setup?: TradeSetup;
  grade?: SetupGrade;
  screenshot?: string | Blob;
  notes?: string;
  pnl?: number;
  riskRewardRatio?: number;
  fees?: number;
  mae?: number;
  mfe?: number;
  // Module 5: Compliance
  complianceScore?: number; // 0-100
  // Sprint 2: Trading Journal Pro
  screenshots?: TradeScreenshot[];
  preTradeEmotion?: EmotionLog;
  postTradeEmotion?: EmotionLog;
  checklist?: {
    items: ChecklistItem[];
    completed: boolean;
    completedAt?: string;
  };
  // P2: Trade Tagging System
  tags?: string[]; // Custom tags like 'Earnings', 'Breakout', 'Momentum', etc.
}

export interface Dividend {
  id?: number;
  date: string;
  ticker: string;
  amount: number;
  credited: boolean;
}

export interface IPOApplication {
  id?: number;
  applicantName: string;
  ipoName: string;
  amount: number;
  status: 'BLOCKED' | 'ALLOTTED' | 'REFUNDED' | 'LISTED';
  upiHandle: string;
  appliedDate: string;
}

export interface TaxRecord {
  id?: number;
  fy: string;
  realizedLTCG: number;
  realizedSTCG: number;
  lastUpdated: string;
}

// Module 6: Strategy Rulebook
export interface Strategy {
  id?: number;
  name: string;
  description?: string;
  rules: string[]; // Checklist items
}

// Module 6: Daily Report Card
export interface DailyReview {
  date: string; // YYYY-MM-DD (Primary Key)
  rating: number; // 1-5 Stars
  marketCondition: 'Trending' | 'Choppy' | 'Volatile' | 'Sideways';
  notes: string;
  didWell: string;
  didPoorly: string;
}

// Module 7: Life Events (Wealth Simulator)
export interface LifeEvent {
  id?: number;
  name: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'EXPENSE' | 'INCOME';
}

export interface PaperTrade {
  id?: number;
  ticker: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  quantity: number;
  openDate: string; // ISO
  status: 'OPEN' | 'CLOSED';
  closePrice?: number;
  closeDate?: number; // timestamp or ISO? Let's use string for ISO or number for easier sorting. Existing 'date' in trades is string ISO. Let's use string ISO.
  pnl?: number;
  notes?: string;
}

// Legacy Vault: Estate Planning Beneficiaries
export interface Beneficiary {
  id?: number;
  name: string;
  relation: string;
  allocation: number; // Percentage 0-100
  color: string;
}

// AI Advisor: Conversation History
export interface Conversation {
  id?: number;
  title: string;
  persona: string; // 'advisor' | 'oracle' | 'wolf' | 'roast'
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview?: string; // First 100 chars of last message
}

export interface ChatMessage {
  id?: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  imageUrl?: string;
}

// Smart Alerts
export interface Alert {
  id?: number;
  type: 'price_target' | 'stop_loss' | 'sip_reminder' | 'tax_deadline' | 'custom';
  title: string;
  description: string;
  triggerValue?: number;
  assetId?: string;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  notified: boolean;
}

// Financial Goals (P1 Enhancement)
export interface Goal {
  id?: number;
  name: string;
  targetAmount: number;
  targetDate: string; // YYYY-MM-DD
  currentAmount: number; // Manually tracked or auto-calculated
  priority: 'Critical' | 'Important' | 'Nice-to-Have';
  category: 'Retirement' | 'House' | 'Education' | 'Travel' | 'Emergency' | 'Wedding' | 'Vehicle' | 'Other';
  color: string;
  linkedInvestmentIds?: string[]; // Investments allocated to this goal
  inflationRate?: number; // Default 6%
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

export interface Transaction {
  id: string; // txn_...
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'credit' | 'debit';
  bankName?: string;
  merchant?: string;
  icon?: string;
  tags?: string[];
  balance?: number;
  upiRef?: string;
  upiId?: string;
  notes?: string;
  excluded?: boolean;
}

export class TradeDatabase extends Dexie {
  trades!: Table<Trade>;
  dividends!: Table<Dividend>;
  ipo_applications!: Table<IPOApplication>;
  investments!: Table<Investment>;
  history!: Table<HistoryEntry>;
  tax_records!: Table<TaxRecord>;
  strategies!: Table<Strategy>;
  daily_reviews!: Table<DailyReview>;
  life_events!: Table<LifeEvent>;
  paper_trades!: Table<PaperTrade>;
  beneficiaries!: Table<Beneficiary>;
  conversations!: Table<Conversation>;
  chat_messages!: Table<ChatMessage>;
  alerts!: Table<Alert>;
  transactions!: Table<Transaction>;
  goals!: Table<Goal>;

  constructor() {
    super('WealthAggregatorDB');

    // Schema definition - Version 15 adds conversations, chat_messages, alerts
    (this as any).version(15).stores({
      trades: '++id, ticker, date, direction, moodEntry, moodExit, setup, grade, entryTime, complianceScore',
      dividends: '++id, date, ticker',
      ipo_applications: '++id, applicantName, ipoName, status, upiHandle',
      investments: 'id, type, platform, *tags, sector, country',
      history: 'date',
      tax_records: '++id, fy',
      strategies: '++id, name',
      daily_reviews: 'date',
      life_events: '++id, date',
      paper_trades: '++id, ticker, status, date',
      beneficiaries: '++id, name',
      conversations: '++id, createdAt, updatedAt, persona',
      chat_messages: '++id, conversationId, timestamp',
      alerts: '++id, type, assetId, isActive, createdAt',
    });

    (this as any).version(16).stores({
      transactions: 'id, date, category, type, bankName'
    });

    // Version 17: Goals table for Multi-Goal Tracking
    (this as any).version(17).stores({
      goals: '++id, name, priority, category, targetDate, createdAt'
    });

    (this as any).on('populate', () => {
      this.strategies.bulkAdd([
        { name: 'Pullback', description: 'Buying the dip in an uptrend', rules: ['Trend is clearly UP', 'Price at Key Support/EMA', 'Volume declined on pullback', 'Bullish candle confirmation'] },
        { name: 'Breakout', description: 'Momentum entry above resistance', rules: ['Consolidation > 2 weeks', 'Volume spike on breakout', 'Relative Strength > Market', 'No immediate resistance overhead'] },
        { name: 'Reversal', description: 'Catching the turn', rules: ['Price at major support zone', 'RSI Divergence visible', 'Change of Character (ChoCH)', 'Stop loss below swing low'] }
      ]);
    });
  }
}

export const db = new TradeDatabase();

export const calculatePnL = (trade: Trade): number => {
  const diff = trade.exitPrice - trade.entryPrice;
  const grossPnL = trade.direction === 'Long'
    ? diff * trade.quantity
    : -diff * trade.quantity;

  return grossPnL - (trade.fees || 0);
};