import type { MarketData, NewsItem } from '@/types';
import type { MarketWatchlistEntry } from './market-watchlist';
import { getMarketWatchlistEntries } from './market-watchlist';
import type { SummarizationResult } from './summarization';

export interface DailyMarketBriefItem {
  symbol: string;
  name: string;
  display: string;
  price: number | null;
  change: number | null;
  stance: 'bullish' | 'neutral' | 'defensive';
  note: string;
  relatedHeadline?: string;
}

export interface DailyMarketBrief {
  available: boolean;
  title: string;
  dateKey: string;
  timezone: string;
  summary: string;
  actionPlan: string;
  riskWatch: string;
  items: DailyMarketBriefItem[];
  provider: string;
  model: string;
  fallback: boolean;
  generatedAt: string;
  headlineCount: number;
}

export interface BuildDailyMarketBriefOptions {
  markets: MarketData[];
  newsByCategory: Record<string, NewsItem[]>;
  timezone?: string;
  now?: Date;
  targets?: MarketWatchlistEntry[];
  summarize?: (
    headlines: string[],
    onProgress?: undefined,
    geoContext?: string,
    lang?: string,
  ) => Promise<SummarizationResult | null>;
}

async function getDefaultSummarizer(): Promise<NonNullable<BuildDailyMarketBriefOptions['summarize']>> {
  const { generateSummary } = await import('./summarization');
  return generateSummary;
}

async function getPersistentCacheApi(): Promise<{
  getPersistentCache: <T>(key: string) => Promise<{ data: T } | null>;
  setPersistentCache: <T>(key: string, data: T) => Promise<void>;
}> {
  const { getPersistentCache, setPersistentCache } = await import('./persistent-cache');
  return { getPersistentCache, setPersistentCache };
}

const CACHE_PREFIX = 'premium:daily-market-brief:v1';
const DEFAULT_SCHEDULE_HOUR = 8;
const DEFAULT_TARGET_COUNT = 4;
const BRIEF_NEWS_CATEGORIES = ['markets', 'economic', 'crypto', 'finance'];
const COMMON_NAME_TOKENS = new Set(['inc', 'corp', 'group', 'holdings', 'company', 'companies', 'class', 'common', 'plc', 'limited', 'ltd', 'adr']);

function resolveTimeZone(timezone?: string): string {
  const candidate = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function getLocalDateParts(date: Date, timezone: string): { year: string; month: string; day: string; hour: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string): string => parts.find((part) => part.type === type)?.value || '';
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
  };
}

function getDateKey(date: Date, timezone: string): string {
  const parts = getLocalDateParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getLocalHour(date: Date, timezone: string): number {
  return Number.parseInt(getLocalDateParts(date, timezone).hour || '0', 10) || 0;
}

function formatTitleDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timezone),
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function sanitizeCacheKeyPart(value: string): string {
  return value.replace(/[^a-z0-9/_-]+/gi, '-').toLowerCase();
}

function getCacheKey(timezone: string): string {
  return `${CACHE_PREFIX}:${sanitizeCacheKeyPart(resolveTimeZone(timezone))}`;
}

function isMeaningfulToken(token: string): boolean {
  return token.length >= 3 && !COMMON_NAME_TOKENS.has(token);
}

function getSymbolTokens(item: Pick<MarketData, 'symbol' | 'display' | 'name'>): string[] {
  const raw = [
    item.symbol,
    item.display,
    ...item.name.toLowerCase().split(/[^a-z0-9]+/gi),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of raw) {
    const normalized = token.trim().toLowerCase();
    if (!isMeaningfulToken(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function matchesMarketHeadline(market: Pick<MarketData, 'symbol' | 'display' | 'name'>, title: string): boolean {
  const normalizedTitle = title.toLowerCase();
  return getSymbolTokens(market).some((token) => {
    if (token.length <= 4) {
      return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedTitle);
    }
    return normalizedTitle.includes(token);
  });
}

function collectHeadlinePool(newsByCategory: Record<string, NewsItem[]>): NewsItem[] {
  return BRIEF_NEWS_CATEGORIES
    .flatMap((category) => newsByCategory[category] || [])
    .filter((item) => !!item?.title)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

function resolveTargets(markets: MarketData[], explicitTargets?: MarketWatchlistEntry[]): MarketData[] {
  const explicitEntries = explicitTargets?.length ? explicitTargets : null;
  const watchlistEntries = explicitEntries ? null : getMarketWatchlistEntries();
  const targetEntries = explicitEntries || (watchlistEntries && watchlistEntries.length > 0 ? watchlistEntries : []);

  const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
  const resolved: MarketData[] = [];
  const seen = new Set<string>();

  for (const entry of targetEntries) {
    const match = bySymbol.get(entry.symbol);
    if (!match || seen.has(match.symbol)) continue;
    seen.add(match.symbol);
    resolved.push(match);
    if (resolved.length >= DEFAULT_TARGET_COUNT) return resolved;
  }

  if (!explicitEntries && !(watchlistEntries && watchlistEntries.length > 0)) {
    for (const market of markets) {
      if (seen.has(market.symbol)) continue;
      seen.add(market.symbol);
      resolved.push(market);
      if (resolved.length >= DEFAULT_TARGET_COUNT) break;
    }
  }

  return resolved;
}

function getStance(change: number | null): DailyMarketBriefItem['stance'] {
  if (typeof change !== 'number') return 'neutral';
  if (change >= 1) return 'bullish';
  if (change <= -1) return 'defensive';
  return 'neutral';
}

function formatSignedPercent(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'flat';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function buildItemNote(change: number | null, relatedHeadline?: string): string {
  const stance = getStance(change);
  const moveNote = stance === 'bullish'
    ? '动能积极，关注领涨标的。'
    : stance === 'defensive'
      ? '价格承压，优先保护资本。'
      : '盘面均衡，等待确认信号后再加仓。';
  return relatedHeadline
    ? `${moveNote} 驱动新闻: ${relatedHeadline}`
    : moveNote;
}

function buildRuleSummary(items: DailyMarketBriefItem[], headlineCount: number): string {
  const bullish = items.filter((item) => item.stance === 'bullish').length;
  const defensive = items.filter((item) => item.stance === 'defensive').length;
  const neutral = items.length - bullish - defensive;

  const bias = bullish > defensive
    ? '关注列表整体风险偏好偏多。'
    : defensive > bullish
      ? '关注列表整体偏防御，市场广度较弱。'
      : '关注列表多空分歧较大，方向不明确。';

  const breadth = `领涨: ${bullish}，中性: ${neutral}，防御: ${defensive}。`;
  const headlines = headlineCount > 0
    ? `新闻流保持活跃，共 ${headlineCount} 条相关头条。`
    : '新闻流较淡，今日价格走势比叙事更重要。';

  return `${bias} ${breadth} ${headlines}`;
}

function buildActionPlan(items: DailyMarketBriefItem[], headlineCount: number): string {
  const bullish = items.filter((item) => item.stance === 'bullish').length;
  const defensive = items.filter((item) => item.stance === 'defensive').length;

  if (defensive > bullish) {
    return headlineCount > 0
      ? '控制总仓位，等待下行企稳，宏观新闻明朗后再加风险敞口。'
      : '控制仓位，等待价格恢复短期动能后再考虑加仓。';
  }

  if (bullish >= 2) {
    return headlineCount > 0
      ? '顺势跟进强势标的，但注意围绕宏观数据发布和个股新闻控制仓位。'
      : '回调时布局最强标的，避免追高开盘冲高。';
  }

  return '保持精选，交易最清晰的相对强势标的，等待指数方向确认后再加码。';
}

function buildRiskWatch(items: DailyMarketBriefItem[], headlines: NewsItem[]): string {
  const defensive = items.filter((item) => item.stance === 'defensive').map((item) => item.display);
  const headlineTitles = headlines.slice(0, 2).map((item) => item.title);

  if (defensive.length > 0 && headlineTitles.length > 0) {
    return `关注 ${defensive.join('、')} 的进一步走弱，同时关注: ${headlineTitles.join(' | ')}`;
  }
  if (defensive.length > 0) {
    return `关注 ${defensive.join('、')} 的进一步走弱，避免在动能衰减时摊薄成本。`;
  }
  if (headlineTitles.length > 0) {
    return `新闻关注: ${headlineTitles.join(' | ')}`;
  }
  return '风险关注重点：宏观数据跟进、指数广度变化、以及强势标的的突然反转。';
}

function buildSummaryInputs(items: DailyMarketBriefItem[], headlines: NewsItem[]): string[] {
  const marketLines = items.map((item) => {
    const change = formatSignedPercent(item.change);
    const price = typeof item.price === 'number' ? ` at ${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '';
    return `${item.name} (${item.display}) is ${change}${price}; stance is ${item.stance}.`;
  });

  const headlineLines = headlines.slice(0, 6).map((item) => item.title.trim()).filter(Boolean);
  return [...marketLines, ...headlineLines];
}

export function shouldRefreshDailyBrief(
  brief: DailyMarketBrief | null | undefined,
  timezone = 'UTC',
  now = new Date(),
  scheduleHour = DEFAULT_SCHEDULE_HOUR,
): boolean {
  if (!brief?.available) return true;
  const resolvedTimezone = resolveTimeZone(timezone || brief.timezone);
  const dateKey = getDateKey(now, resolvedTimezone);
  if (brief.dateKey === dateKey) return false;
  return getLocalHour(now, resolvedTimezone) >= scheduleHour;
}

export async function getCachedDailyMarketBrief(timezone?: string): Promise<DailyMarketBrief | null> {
  const resolvedTimezone = resolveTimeZone(timezone);
  const { getPersistentCache } = await getPersistentCacheApi();
  const envelope = await getPersistentCache<DailyMarketBrief>(getCacheKey(resolvedTimezone));
  return envelope?.data ?? null;
}

export async function cacheDailyMarketBrief(brief: DailyMarketBrief): Promise<void> {
  const { setPersistentCache } = await getPersistentCacheApi();
  await setPersistentCache(getCacheKey(brief.timezone), brief);
}

export async function buildDailyMarketBrief(options: BuildDailyMarketBriefOptions): Promise<DailyMarketBrief> {
  const now = options.now || new Date();
  const timezone = resolveTimeZone(options.timezone);
  const trackedMarkets = resolveTargets(options.markets, options.targets).slice(0, DEFAULT_TARGET_COUNT);
  const relevantHeadlines = collectHeadlinePool(options.newsByCategory);

  const items: DailyMarketBriefItem[] = trackedMarkets.map((market) => {
    const relatedHeadline = relevantHeadlines.find((headline) => matchesMarketHeadline(market, headline.title))?.title;
    return {
      symbol: market.symbol,
      name: market.name,
      display: market.display,
      price: market.price,
      change: market.change,
      stance: getStance(market.change),
      note: buildItemNote(market.change, relatedHeadline),
      ...(relatedHeadline ? { relatedHeadline } : {}),
    };
  });

  if (items.length === 0) {
    return {
      available: false,
      title: `每日市场简报 • ${formatTitleDate(now, timezone)}`,
      dateKey: getDateKey(now, timezone),
      timezone,
      summary: '每日简报的市场数据暂不可用。',
      actionPlan: '',
      riskWatch: '',
      items: [],
      provider: 'rules',
      model: '',
      fallback: true,
      generatedAt: now.toISOString(),
      headlineCount: 0,
    };
  }

  const summaryInputs = buildSummaryInputs(items, relevantHeadlines);
  let summary = buildRuleSummary(items, relevantHeadlines.length);
  let provider = 'rules';
  let model = '';
  let fallback = true;

  if (summaryInputs.length >= 2) {
    try {
      const summaryProvider = options.summarize || await getDefaultSummarizer();
      const { getCurrentLanguage } = await import('./i18n');
      const lang = getCurrentLanguage();
      const generated = await summaryProvider(
        summaryInputs,
        undefined,
        lang === 'zh' ? '根据关注列表生成的每日市场简报，请用中文回复' : 'Daily market briefing for a tracked watchlist',
        lang,
      );
      if (generated?.summary) {
        summary = generated.summary.trim();
        provider = generated.provider;
        model = generated.model;
        fallback = false;
      }
    } catch (err) {
      console.warn('[DailyBrief] AI summarization failed, using rules-based fallback:', (err as Error).message);
    }
  }

  return {
    available: true,
    title: `每日市场简报 • ${formatTitleDate(now, timezone)}`,
    dateKey: getDateKey(now, timezone),
    timezone,
    summary,
    actionPlan: buildActionPlan(items, relevantHeadlines.length),
    riskWatch: buildRiskWatch(items, relevantHeadlines),
    items,
    provider,
    model,
    fallback,
    generatedAt: now.toISOString(),
    headlineCount: relevantHeadlines.length,
  };
}
