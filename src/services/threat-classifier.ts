export type { ThreatLevel, EventCategory, ThreatClassification } from '@/types';
import type { ThreatLevel, EventCategory, ThreatClassification } from '@/types';

import { getCSSColor } from '@/utils';
import { getRpcBaseUrl } from '@/services/rpc-client';

/** @deprecated Use getThreatColor() instead for runtime CSS variable reads */
export const THREAT_COLORS: Record<ThreatLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
};

const THREAT_VAR_MAP: Record<ThreatLevel, string> = {
  critical: '--threat-critical',
  high: '--threat-high',
  medium: '--threat-medium',
  low: '--threat-low',
  info: '--threat-info',
};

export function getThreatColor(level: string): string {
  return getCSSColor(THREAT_VAR_MAP[level as ThreatLevel] || '--text-dim');
}

export const THREAT_PRIORITY: Record<ThreatLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

import { t } from '@/services/i18n';

export function getThreatLabel(level: ThreatLevel): string {
  return t(`components.threatLabels.${level}`);
}

export const THREAT_LABELS: Record<ThreatLevel, string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
  info: 'INFO',
};

type KeywordMap = Record<string, EventCategory>;

const CRITICAL_KEYWORDS: KeywordMap = {
  'nuclear strike': 'military',
  'nuclear attack': 'military',
  'nuclear war': 'military',
  'invasion': 'conflict',
  'declaration of war': 'conflict',
  'declares war': 'conflict',
  'all-out war': 'conflict',
  'full-scale war': 'conflict',
  'martial law': 'military',
  'coup': 'military',
  'coup attempt': 'military',
  'genocide': 'conflict',
  'ethnic cleansing': 'conflict',
  'chemical attack': 'terrorism',
  'biological attack': 'terrorism',
  'dirty bomb': 'terrorism',
  'mass casualty': 'conflict',
  'massive strikes': 'military',
  'military strikes': 'military',
  'retaliatory strikes': 'military',
  'launches strikes': 'military',
  'launch attacks on iran': 'military',
  'launch attack on iran': 'military',
  'attacks on iran': 'military',
  'strikes on iran': 'military',
  'strikes iran': 'military',
  'bombs iran': 'military',
  'attacks iran': 'military',
  'attack on iran': 'military',
  'attack iran': 'military',
  'attacked iran': 'military',
  'attack against iran': 'military',
  'bombing iran': 'military',
  'bombed iran': 'military',
  'war with iran': 'conflict',
  'war on iran': 'conflict',
  'war against iran': 'conflict',
  'iran retaliates': 'military',
  'iran strikes': 'military',
  'iran launches': 'military',
  'iran attacks': 'military',
  'pandemic declared': 'health',
  'health emergency': 'health',
  'nato article 5': 'military',
  'evacuation order': 'disaster',
  'meltdown': 'disaster',
  'nuclear meltdown': 'disaster',
  'major combat operations': 'military',
  'declared war': 'conflict',
};

const HIGH_KEYWORDS: KeywordMap = {
  'war': 'conflict',
  'armed conflict': 'conflict',
  'airstrike': 'conflict',
  'airstrikes': 'conflict',
  'air strike': 'conflict',
  'air strikes': 'conflict',
  'drone strike': 'conflict',
  'drone strikes': 'conflict',
  'strikes': 'conflict',
  'missile': 'military',
  'missile launch': 'military',
  'missiles fired': 'military',
  'troops deployed': 'military',
  'military escalation': 'military',
  'military operation': 'military',
  'ground offensive': 'military',
  'bombing': 'conflict',
  'bombardment': 'conflict',
  'shelling': 'conflict',
  'casualties': 'conflict',
  'killed in': 'conflict',
  'hostage': 'terrorism',
  'terrorist': 'terrorism',
  'terror attack': 'terrorism',
  'assassination': 'crime',
  'cyber attack': 'cyber',
  'ransomware': 'cyber',
  'data breach': 'cyber',
  'sanctions': 'economic',
  'embargo': 'economic',
  'earthquake': 'disaster',
  'tsunami': 'disaster',
  'hurricane': 'disaster',
  'typhoon': 'disaster',
  'strike on': 'conflict',
  'strikes on': 'conflict',
  'attack on': 'conflict',
  'attack against': 'conflict',
  'attacks on': 'conflict',
  'launched attack': 'conflict',
  'launched attacks': 'conflict',
  'launches attack': 'conflict',
  'launches attacks': 'conflict',
  'explosions': 'conflict',
  'military operations': 'military',
  'combat operations': 'military',
  'retaliatory strike': 'military',
  'retaliatory attack': 'military',
  'retaliatory attacks': 'military',
  'preemptive strike': 'military',
  'preemptive attack': 'military',
  'preventive attack': 'military',
  'preventative attack': 'military',
  'military offensive': 'military',
  'ballistic missile': 'military',
  'cruise missile': 'military',
  'air defense intercepted': 'military',
  'forces struck': 'conflict',
};

const MEDIUM_KEYWORDS: KeywordMap = {
  'protest': 'protest',
  'protests': 'protest',
  'riot': 'protest',
  'riots': 'protest',
  'unrest': 'protest',
  'demonstration': 'protest',
  'strike action': 'protest',
  'military exercise': 'military',
  'naval exercise': 'military',
  'arms deal': 'military',
  'weapons sale': 'military',
  'diplomatic crisis': 'diplomatic',
  'ambassador recalled': 'diplomatic',
  'expel diplomats': 'diplomatic',
  'trade war': 'economic',
  'tariff': 'economic',
  'recession': 'economic',
  'inflation': 'economic',
  'market crash': 'economic',
  'flood': 'disaster',
  'flooding': 'disaster',
  'wildfire': 'disaster',
  'volcano': 'disaster',
  'eruption': 'disaster',
  'outbreak': 'health',
  'epidemic': 'health',
  'infection spread': 'health',
  'oil spill': 'environmental',
  'pipeline explosion': 'infrastructure',
  'blackout': 'infrastructure',
  'power outage': 'infrastructure',
  'internet outage': 'infrastructure',
  'derailment': 'infrastructure',
};

const LOW_KEYWORDS: KeywordMap = {
  'election': 'diplomatic',
  'vote': 'diplomatic',
  'referendum': 'diplomatic',
  'summit': 'diplomatic',
  'treaty': 'diplomatic',
  'agreement': 'diplomatic',
  'negotiation': 'diplomatic',
  'talks': 'diplomatic',
  'peacekeeping': 'diplomatic',
  'humanitarian aid': 'diplomatic',
  'ceasefire': 'diplomatic',
  'peace treaty': 'diplomatic',
  'climate change': 'environmental',
  'emissions': 'environmental',
  'pollution': 'environmental',
  'deforestation': 'environmental',
  'drought': 'environmental',
  'vaccine': 'health',
  'vaccination': 'health',
  'disease': 'health',
  'virus': 'health',
  'public health': 'health',
  'covid': 'health',
  'interest rate': 'economic',
  'gdp': 'economic',
  'unemployment': 'economic',
  'regulation': 'economic',
};

const TECH_HIGH_KEYWORDS: KeywordMap = {
  'major outage': 'infrastructure',
  'service down': 'infrastructure',
  'global outage': 'infrastructure',
  'zero-day': 'cyber',
  'critical vulnerability': 'cyber',
  'supply chain attack': 'cyber',
  'mass layoff': 'economic',
};

const TECH_MEDIUM_KEYWORDS: KeywordMap = {
  'outage': 'infrastructure',
  'breach': 'cyber',
  'hack': 'cyber',
  'vulnerability': 'cyber',
  'layoff': 'economic',
  'layoffs': 'economic',
  'antitrust': 'economic',
  'monopoly': 'economic',
  'ban': 'economic',
  'shutdown': 'infrastructure',
};

const TECH_LOW_KEYWORDS: KeywordMap = {
  'ipo': 'economic',
  'funding': 'economic',
  'acquisition': 'economic',
  'merger': 'economic',
  'launch': 'tech',
  'release': 'tech',
  'update': 'tech',
  'partnership': 'economic',
  'startup': 'tech',
  'ai model': 'tech',
  'open source': 'tech',
};

// Chinese keyword maps — no word boundary needed for CJK
const ZH_CRITICAL_KEYWORDS: KeywordMap = {
  '\u6838\u6253\u51fb': 'military',       // 核打击
  '\u6838\u6218\u4e89': 'military',       // 核战争
  '\u5168\u9762\u6218\u4e89': 'conflict', // 全面战争
  '\u5165\u4fb5': 'conflict',             // 入侵
  '\u5ba3\u6218': 'conflict',             // 宣战
  '\u6234\u4e25\u4ee4': 'military',       // 戒严令
  '\u653f\u53d8': 'military',             // 政变
  '\u5316\u5b66\u6b66\u5668\u88ad\u51fb': 'terrorism', // 化学武器袭击
  '\u751f\u7269\u6b66\u5668': 'terrorism', // 生物武器
  '\u5927\u89c4\u6a21\u4f24\u4ea1': 'conflict', // 大规模伤亡
  '\u53f0\u6d77\u5371\u673a': 'military', // 台海危机
  '\u6b66\u7edf': 'military',             // 武统
  '\u653b\u53f0': 'military',             // 攻台
  '\u5168\u9762\u5c01\u9501': 'military', // 全面封锁
};

const ZH_HIGH_KEYWORDS: KeywordMap = {
  '\u7a7a\u88ad': 'conflict',             // 空袭
  '\u5bfc\u5f39\u53d1\u5c04': 'military', // 导弹发射
  '\u5bfc\u5f39': 'military',             // 导弹
  '\u519b\u4e8b\u5347\u7ea7': 'military', // 军事升级
  '\u519b\u4e8b\u884c\u52a8': 'military', // 军事行动
  '\u70ae\u51fb': 'conflict',             // 炮击
  '\u8f70\u70b8': 'conflict',             // 轰炸
  '\u4f24\u4ea1': 'conflict',             // 伤亡
  '\u6050\u6016\u88ad\u51fb': 'terrorism', // 恐怖袭击
  '\u7f51\u7edc\u653b\u51fb': 'cyber',   // 网络攻击
  '\u52d2\u7d22\u8f6f\u4ef6': 'cyber',   // 勒索软件
  '\u5236\u88c1': 'economic',             // 制裁
  '\u7981\u8fd0': 'economic',             // 禁运
  '\u5730\u9707': 'disaster',             // 地震
  '\u6d77\u5578': 'disaster',             // 海啸
  '\u53f0\u98ce': 'disaster',             // 台风
  '\u519b\u6f14': 'military',             // 军演
  '\u5b9e\u5f39\u5c04\u51fb': 'military', // 实弹射击
  '\u6218\u6597\u673a\u8d77\u98de': 'military', // 战斗机起飞
  '\u822a\u6bcd\u7f16\u961f': 'military', // 航母编队
  '\u8d8a\u8fc7\u4e2d\u7ebf': 'military', // 越过中线
  '\u9632\u7a7a\u8bc6\u522b\u533a': 'military', // 防空识别区
};

const ZH_MEDIUM_KEYWORDS: KeywordMap = {
  '\u6297\u8bae': 'protest',              // 抗议
  '\u793a\u5a01': 'protest',              // 示威
  '\u9a9a\u4e71': 'protest',              // 骚乱
  '\u8d38\u6613\u6218': 'economic',       // 贸易战
  '\u5173\u7a0e': 'economic',             // 关税
  '\u901a\u8d27\u81a8\u80c0': 'economic', // 通货膨胀
  '\u80a1\u5e02\u5d29\u76d8': 'economic', // 股市崩盘
  '\u6d2a\u6c34': 'disaster',             // 洪水
  '\u5c71\u706b': 'disaster',             // 山火
  '\u706b\u5c71\u7206\u53d1': 'disaster', // 火山爆发
  '\u7591\u4f3c\u75ab\u60c5': 'health',   // 疑似疫情
  '\u7ba1\u9053\u7206\u70b8': 'infrastructure', // 管道爆炸
  '\u505c\u7535': 'infrastructure',       // 停电
  '\u65ad\u7f51': 'infrastructure',       // 断网
  '\u5916\u4ea4\u5371\u673a': 'diplomatic', // 外交危机
  '\u53ec\u56de\u5927\u4f7f': 'diplomatic', // 召回大使
  '\u9a71\u9010\u5916\u4ea4\u5b98': 'diplomatic', // 驱逐外交官
  '\u7a00\u571f\u7ba1\u63a7': 'economic', // 稀土管控
  '\u82af\u7247\u7981\u4ee4': 'economic', // 芯片禁令
  '\u51fa\u53e3\u7ba1\u5236': 'economic', // 出口管制
};

const ZH_LOW_KEYWORDS: KeywordMap = {
  '\u9009\u4e3e': 'diplomatic',           // 选举
  '\u5cf0\u4f1a': 'diplomatic',           // 峰会
  '\u6761\u7ea6': 'diplomatic',           // 条约
  '\u505c\u706b': 'diplomatic',           // 停火
  '\u548c\u5e73\u534f\u8bae': 'diplomatic', // 和平协议
  '\u8c08\u5224': 'diplomatic',           // 谈判
  '\u5229\u7387': 'economic',             // 利率
  '\u5931\u4e1a\u7387': 'economic',       // 失业率
  '\u6c14\u5019\u53d8\u5316': 'environmental', // 气候变化
  '\u5e72\u65f1': 'environmental',        // 干旱
  '\u6c61\u67d3': 'environmental',        // 污染
  '\u75ab\u82d7': 'health',               // 疫苗
  '\u75ab\u60c5': 'health',               // 疫情
};

const EXCLUSIONS = [
  'protein', 'couples', 'relationship', 'dating', 'diet', 'fitness',
  'recipe', 'cooking', 'shopping', 'fashion', 'celebrity', 'movie',
  'tv show', 'sports', 'game', 'concert', 'festival', 'wedding',
  'vacation', 'travel tips', 'life hack', 'self-care', 'wellness',
  'strikes deal', 'strikes agreement', 'strikes partnership',
];

const SHORT_KEYWORDS = new Set([
  'war', 'coup', 'ban', 'vote', 'riot', 'riots', 'hack', 'talks', 'ipo', 'gdp',
  'virus', 'disease', 'flood', 'strikes',
]);

const TRAILING_BOUNDARY_KEYWORDS = new Set([
  'attack iran', 'attacked iran', 'attack on iran', 'attack against iran',
  'attacks on iran', 'launch attacks on iran', 'launch attack on iran',
  'bombing iran', 'bombed iran', 'strikes iran', 'attacks iran',
  'bombs iran', 'war on iran', 'war with iran', 'war against iran',
  'iran retaliates', 'iran strikes', 'iran launches', 'iran attacks',
]);

const keywordRegexCache = new Map<string, RegExp>();

function getKeywordRegex(kw: string): RegExp {
  let re = keywordRegexCache.get(kw);
  if (!re) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (SHORT_KEYWORDS.has(kw)) {
      re = new RegExp(`\\b${escaped}\\b`);
    } else if (TRAILING_BOUNDARY_KEYWORDS.has(kw)) {
      re = new RegExp(`${escaped}(?![\\w-])`);
    } else {
      re = new RegExp(escaped);
    }
    keywordRegexCache.set(kw, re);
  }
  return re;
}

function matchKeywords(
  titleLower: string,
  keywords: KeywordMap
): { keyword: string; category: EventCategory } | null {
  for (const [kw, cat] of Object.entries(keywords)) {
    if (getKeywordRegex(kw).test(titleLower)) {
      return { keyword: kw, category: cat };
    }
  }
  return null;
}

// Compound escalation: HIGH military/conflict + critical geopolitical target → CRITICAL
// Handles headlines like "strikes by US and Israel on Iran" where words aren't adjacent
const ESCALATION_ACTIONS = /\b(attack|attacks|attacked|strike|strikes|struck|bomb|bombs|bombed|bombing|shell|shelled|shelling|missile|missiles|intercept|intercepted|retaliates|retaliating|retaliation|killed|casualties|offensive|invaded|invades)\b/;
const ESCALATION_TARGETS = /\b(iran|tehran|isfahan|tabriz|russia|moscow|china|beijing|taiwan|taipei|north korea|pyongyang|nato|us base|us forces|american forces|us military)\b|\u4f0a\u6717|\u4fc4\u7f57\u65af|\u4e2d\u56fd|\u5317\u4eac|\u53f0\u6e7e|\u53f0\u5317|\u671d\u9c9c|\u5e73\u58e4|\u5357\u6d77|\u4e1c\u6d77/;

function shouldEscalateToCritical(lower: string, matchCat: EventCategory): boolean {
  if (matchCat !== 'conflict' && matchCat !== 'military') return false;
  return ESCALATION_ACTIONS.test(lower) && ESCALATION_TARGETS.test(lower);
}

// CJK keyword matching — simple includes (no word boundary needed)
function matchZhKeywords(
  text: string,
  keywords: KeywordMap
): { keyword: string; category: EventCategory } | null {
  for (const [kw, cat] of Object.entries(keywords)) {
    if (text.includes(kw)) {
      return { keyword: kw, category: cat };
    }
  }
  return null;
}

export function classifyByKeyword(title: string, variant = 'full'): ThreatClassification {
  const lower = title.toLowerCase();

  if (EXCLUSIONS.some(ex => lower.includes(ex))) {
    return { level: 'info', category: 'general', confidence: 0.3, source: 'keyword' };
  }

  const isTech = variant === 'tech';

  // Priority cascade: critical → high → medium → low → info
  // Check both English and Chinese keywords at each level
  let match = matchKeywords(lower, CRITICAL_KEYWORDS) ?? matchZhKeywords(title, ZH_CRITICAL_KEYWORDS);
  if (match) return { level: 'critical', category: match.category, confidence: 0.9, source: 'keyword' };

  match = matchKeywords(lower, HIGH_KEYWORDS) ?? matchZhKeywords(title, ZH_HIGH_KEYWORDS);
  if (match) {
    // Compound escalation: military action + critical geopolitical target → CRITICAL
    if (shouldEscalateToCritical(lower, match.category)) {
      return { level: 'critical', category: match.category, confidence: 0.85, source: 'keyword' };
    }
    return { level: 'high', category: match.category, confidence: 0.8, source: 'keyword' };
  }

  if (isTech) {
    match = matchKeywords(lower, TECH_HIGH_KEYWORDS);
    if (match) return { level: 'high', category: match.category, confidence: 0.75, source: 'keyword' };
  }

  match = matchKeywords(lower, MEDIUM_KEYWORDS) ?? matchZhKeywords(title, ZH_MEDIUM_KEYWORDS);
  if (match) return { level: 'medium', category: match.category, confidence: 0.7, source: 'keyword' };

  if (isTech) {
    match = matchKeywords(lower, TECH_MEDIUM_KEYWORDS);
    if (match) return { level: 'medium', category: match.category, confidence: 0.65, source: 'keyword' };
  }

  match = matchKeywords(lower, LOW_KEYWORDS) ?? matchZhKeywords(title, ZH_LOW_KEYWORDS);
  if (match) return { level: 'low', category: match.category, confidence: 0.6, source: 'keyword' };

  if (isTech) {
    match = matchKeywords(lower, TECH_LOW_KEYWORDS);
    if (match) return { level: 'low', category: match.category, confidence: 0.55, source: 'keyword' };
  }

  return { level: 'info', category: 'general', confidence: 0.3, source: 'keyword' };
}

// Batched AI classification — collects headlines then fires parallel classifyEvent RPCs
import {
  IntelligenceServiceClient,
  ApiError,
  type ClassifyEventResponse,
} from '@/generated/client/worldmonitor/intelligence/v1/service_client';
import { createCircuitBreaker } from '@/utils';

const classifyClient = new IntelligenceServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });

const classifyBreaker = createCircuitBreaker<ThreatClassification | null>({
  name: 'AIClassify',
  cacheTtlMs: 6 * 60 * 60 * 1000,
  persistCache: true,
  maxCacheEntries: 256,
});

const VALID_LEVELS: Record<string, ThreatLevel> = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info',
};

function toThreat(resp: ClassifyEventResponse): ThreatClassification | null {
  const c = resp.classification;
  if (!c) return null;
  // Raw level preserved in subcategory by the handler
  const level = VALID_LEVELS[c.subcategory] ?? VALID_LEVELS[c.category] ?? null;
  if (!level) return null;
  return {
    level,
    category: c.category as EventCategory,
    confidence: c.confidence || 0.9,
    source: 'llm',
  };
}

type BatchJob = {
  title: string;
  variant: string;
  resolve: (v: ThreatClassification | null) => void;
  attempts?: number;
};

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 500;
const STAGGER_BASE_MS = 2100;
const STAGGER_JITTER_MS = 200;
const MIN_GAP_MS = 2000;
const MAX_RETRIES = 2;
const MAX_QUEUE_LENGTH = 100;
const BASE_PAUSE_MS = 60_000;
const MAX_PAUSE_MS = 300_000;
let batchPaused = false;
let batchInFlight = false;
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let lastRequestAt = 0;
let consecutive429s = 0;
const batchQueue: BatchJob[] = [];

async function waitForGap(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_GAP_MS) {
    await new Promise<void>(r => setTimeout(r, MIN_GAP_MS - elapsed));
  }
  const jitter = Math.floor(Math.random() * STAGGER_JITTER_MS * 2) - STAGGER_JITTER_MS;
  const extra = Math.max(0, STAGGER_BASE_MS - MIN_GAP_MS + jitter);
  if (extra > 0) await new Promise<void>(r => setTimeout(r, extra));
  lastRequestAt = Date.now();
}

function flushBatch(): void {
  batchTimer = null;
  if (batchPaused || batchInFlight || batchQueue.length === 0) return;
  batchInFlight = true;

  const batch = batchQueue.splice(0, BATCH_SIZE);
  if (batch.length === 0) { batchInFlight = false; return; }

  (async () => {
    try {
      for (let i = 0; i < batch.length; i++) {
        const job = batch[i]!;
        if (batchPaused) { job.resolve(null); continue; }

        await waitForGap();

        try {
          const resp = await classifyClient.classifyEvent({
            title: job.title, description: '', source: '', country: '',
          });
          consecutive429s = 0;
          job.resolve(toThreat(resp));
        } catch (err) {
          if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 429 || err.statusCode >= 500)) {
            batchPaused = true;
            let delay: number;
            if (err.statusCode === 401) {
              delay = 120_000;
            } else if (err.statusCode === 429) {
              consecutive429s++;
              delay = Math.min(BASE_PAUSE_MS * 2 ** (consecutive429s - 1), MAX_PAUSE_MS);
            } else {
              delay = 30_000;
            }
            console.warn(`[Classify] ${err.statusCode} — pausing AI classification for ${delay / 1000}s (backoff #${consecutive429s})`);
            const remaining = batch.slice(i + 1);
            if ((job.attempts ?? 0) < MAX_RETRIES) {
              job.attempts = (job.attempts ?? 0) + 1;
              batchQueue.unshift(job);
            } else {
              job.resolve(null);
            }
            for (let j = remaining.length - 1; j >= 0; j--) {
              batchQueue.unshift(remaining[j]!);
            }
            // On repeated 429s, drop excess queue to avoid hammering on resume
            if (consecutive429s >= 2 && batchQueue.length > BATCH_SIZE) {
              const dropped = batchQueue.splice(BATCH_SIZE);
              for (const d of dropped) d.resolve(null);
              console.warn(`[Classify] Dropped ${dropped.length} queued items after repeated 429s`);
            }
            batchInFlight = false;
            setTimeout(() => { batchPaused = false; scheduleBatch(); }, delay);
            return;
          }
          job.resolve(null);
        }
      }
    } finally {
      if (batchInFlight) {
        batchInFlight = false;
        scheduleBatch();
      }
    }
  })();
}

function scheduleBatch(): void {
  if (batchTimer || batchPaused || batchInFlight || batchQueue.length === 0) return;
  if (batchQueue.length >= BATCH_SIZE) {
    flushBatch();
  } else {
    batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
  }
}

function classifyWithAIUncached(
  title: string,
  variant: string
): Promise<ThreatClassification | null> {
  return new Promise((resolve) => {
    if (batchQueue.length >= MAX_QUEUE_LENGTH) {
      console.warn(`[Classify] Queue full (${MAX_QUEUE_LENGTH}), dropping classification for: ${title.slice(0, 60)}`);
      resolve(null);
      return;
    }
    batchQueue.push({ title, variant, resolve });
    scheduleBatch();
  });
}

export function classifyWithAI(
  title: string,
  variant: string,
): Promise<ThreatClassification | null> {
  const cacheKey = title.trim().toLowerCase().replace(/\s+/g, ' ');
  return classifyBreaker.execute(
    () => classifyWithAIUncached(title, variant),
    null,
    { cacheKey, shouldCache: (result) => result !== null },
  );
}

export function aggregateThreats(
  items: Array<{ threat?: ThreatClassification; tier?: number }>
): ThreatClassification {
  const withThreat = items.filter(i => i.threat);
  if (withThreat.length === 0) {
    return { level: 'info', category: 'general', confidence: 0.3, source: 'keyword' };
  }

  // Level = max across items
  let maxLevel: ThreatLevel = 'info';
  let maxPriority = 0;
  for (const item of withThreat) {
    const p = THREAT_PRIORITY[item.threat!.level];
    if (p > maxPriority) {
      maxPriority = p;
      maxLevel = item.threat!.level;
    }
  }

  // Category = most frequent
  const catCounts = new Map<EventCategory, number>();
  for (const item of withThreat) {
    const cat = item.threat!.category;
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  let topCat: EventCategory = 'general';
  let topCount = 0;
  for (const [cat, count] of catCounts) {
    if (count > topCount) {
      topCount = count;
      topCat = cat;
    }
  }

  // Confidence = weighted avg by source tier (lower tier = higher weight)
  let weightedSum = 0;
  let weightTotal = 0;
  for (const item of withThreat) {
    const weight = item.tier ? (6 - Math.min(item.tier, 5)) : 1;
    weightedSum += item.threat!.confidence * weight;
    weightTotal += weight;
  }

  return {
    level: maxLevel,
    category: topCat,
    confidence: weightTotal > 0 ? weightedSum / weightTotal : 0.5,
    source: 'keyword',
  };
}
