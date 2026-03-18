export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  context: string;
}

export interface PortfolioHistoryPoint {
  date: string;
  portfolio: number;
  invested: number;
}

export interface AllocationItem {
  label: string;
  percentage: number;
  amount: string;
  note: string;
}

export interface Holding {
  symbol: string;
  name: string;
  shares: string;
  price: string;
  dayChange: string;
  marketValue: string;
  allocation: string;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: string;
  move: string;
  thesis: string;
}

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: "Net worth",
    value: "EUR 482,430",
    delta: "+3.8%",
    trend: "up",
    context: "Across investing, cash, and liabilities",
  },
  {
    label: "Invested assets",
    value: "EUR 361,080",
    delta: "+1.4%",
    trend: "up",
    context: "Equities, ETFs, and alternative buckets",
  },
  {
    label: "Cash runway",
    value: "18.4 mo",
    delta: "-0.6 mo",
    trend: "down",
    context: "Based on trailing 6 month spend",
  },
  {
    label: "Monthly surplus",
    value: "EUR 5,260",
    delta: "+EUR 840",
    trend: "up",
    context: "Income minus recurring outflows",
  },
];

export const portfolioHistory: Record<
  "1m" | "3m" | "ytd",
  PortfolioHistoryPoint[]
> = {
  "1m": [
    { date: "2026-02-12", portfolio: 451200, invested: 337900 },
    { date: "2026-02-16", portfolio: 455040, invested: 339200 },
    { date: "2026-02-20", portfolio: 459310, invested: 341150 },
    { date: "2026-02-24", portfolio: 456920, invested: 342600 },
    { date: "2026-02-28", portfolio: 463280, invested: 346150 },
    { date: "2026-03-04", portfolio: 469880, invested: 351000 },
    { date: "2026-03-08", portfolio: 476320, invested: 356900 },
    { date: "2026-03-11", portfolio: 482430, invested: 361080 },
  ],
  "3m": [
    { date: "2025-12-15", portfolio: 426420, invested: 322500 },
    { date: "2026-01-01", portfolio: 431880, invested: 326300 },
    { date: "2026-01-15", portfolio: 439510, invested: 329900 },
    { date: "2026-01-31", portfolio: 444220, invested: 332650 },
    { date: "2026-02-15", portfolio: 455040, invested: 339200 },
    { date: "2026-02-28", portfolio: 463280, invested: 346150 },
    { date: "2026-03-11", portfolio: 482430, invested: 361080 },
  ],
  ytd: [
    { date: "2026-01-01", portfolio: 431880, invested: 326300 },
    { date: "2026-01-18", portfolio: 437760, invested: 328450 },
    { date: "2026-02-01", portfolio: 444220, invested: 332650 },
    { date: "2026-02-15", portfolio: 455040, invested: 339200 },
    { date: "2026-02-28", portfolio: 463280, invested: 346150 },
    { date: "2026-03-11", portfolio: 482430, invested: 361080 },
  ],
};

export const allocationItems: AllocationItem[] = [
  {
    label: "Global equities",
    percentage: 48,
    amount: "EUR 173.3k",
    note: "Core diversified ETF exposure",
  },
  {
    label: "Individual stocks",
    percentage: 22,
    amount: "EUR 79.4k",
    note: "Higher conviction growth positions",
  },
  {
    label: "Fixed income",
    percentage: 13,
    amount: "EUR 46.9k",
    note: "Short-duration and treasury ladder",
  },
  {
    label: "Cash & equivalents",
    percentage: 11,
    amount: "EUR 39.7k",
    note: "Liquidity buffer for 18 months runway",
  },
  {
    label: "Alternatives",
    percentage: 6,
    amount: "EUR 21.8k",
    note: "Private funds and commodity sleeve",
  },
];

export const holdings: Holding[] = [
  {
    symbol: "VWCE",
    name: "Vanguard FTSE All-World",
    shares: "428",
    price: "EUR 121.44",
    dayChange: "+0.82%",
    marketValue: "EUR 51,976",
    allocation: "14.4%",
  },
  {
    symbol: "BRK.B",
    name: "Berkshire Hathaway B",
    shares: "92",
    price: "USD 498.10",
    dayChange: "+0.31%",
    marketValue: "EUR 42,278",
    allocation: "11.7%",
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    shares: "56",
    price: "USD 422.71",
    dayChange: "+1.26%",
    marketValue: "EUR 21,840",
    allocation: "6.0%",
  },
  {
    symbol: "IB01",
    name: "iShares EUR Treasury 0-1yr",
    shares: "304",
    price: "EUR 108.23",
    dayChange: "+0.09%",
    marketValue: "EUR 32,902",
    allocation: "9.1%",
  },
  {
    symbol: "CSH",
    name: "Operating cash reserve",
    shares: "1",
    price: "EUR 39,700",
    dayChange: "0.00%",
    marketValue: "EUR 39,700",
    allocation: "11.0%",
  },
];

export const watchlist: WatchlistItem[] = [
  {
    symbol: "ASML",
    name: "ASML Holding",
    price: "EUR 894.20",
    move: "+2.3%",
    thesis: "Quality compounder, waiting for a better entry on semis pullback.",
  },
  {
    symbol: "NVO",
    name: "Novo Nordisk",
    price: "DKK 736.40",
    move: "-0.9%",
    thesis: "Defensive growth with a long-duration obesity tailwind.",
  },
  {
    symbol: "TLT",
    name: "iShares 20+ Year Treasury",
    price: "USD 94.18",
    move: "+0.4%",
    thesis: "Potential hedge if growth slows and rates compress.",
  },
  {
    symbol: "EUNN",
    name: "Europe Small Cap ETF",
    price: "EUR 52.06",
    move: "+1.1%",
    thesis: "Candidate for diversifying regional factor exposure.",
  },
];
