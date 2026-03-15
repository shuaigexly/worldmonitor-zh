import { Panel } from './Panel';
import { WindowedList } from './VirtualList';
import type { NewsItem, ClusteredEvent, DeviationLevel, RelatedAsset, RelatedAssetContext } from '@/types';
import { THREAT_PRIORITY } from '@/services/threat-classifier';
import { formatTime, getCSSColor } from '@/utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { analysisWorker, enrichWithVelocityML, getClusterAssetContext, MAX_DISTANCE_KM, activityTracker, generateSummary, translateText } from '@/services';
import { getSourcePropagandaRisk, getSourceTier, getSourceType } from '@/config/feeds';
import { SITE_VARIANT } from '@/config';
import { t, getCurrentLanguage } from '@/services/i18n';

type SortMode = 'relevance' | 'newest';

/** Category name translations for zh locale */
const CATEGORY_ZH: Record<string, string> = {
  conflict: '冲突', protest: '抗议', disaster: '灾害', diplomatic: '外交',
  economic: '经济', terrorism: '恐怖主义', cyber: '网络安全', health: '卫生',
  environmental: '环境', military: '军事', crime: '犯罪', infrastructure: '基础设施',
  tech: '科技', general: '综合',
};

/** Feed source name translations for zh locale */
const SOURCE_ZH: Record<string, string> = {
  'Bond Market': '债券市场', 'Oil & Gas': '石油天然气', 'Forex News': '外汇新闻',
  'Seeking Alpha': 'Seeking Alpha', 'CNBC': 'CNBC', 'MarketWatch': 'MarketWatch',
  'Reuters Business': '路透商业', 'Yahoo Finance': '雅虎财经', 'Financial Times': '金融时报',
  'Bloomberg Commodities': '彭博大宗商品', 'Reuters Commodities': '路透大宗商品',
  'CoinDesk': 'CoinDesk', 'CoinTelegraph': 'CoinTelegraph',
  'BBC World': 'BBC 国际', 'Guardian World': '卫报国际', 'AP News': '美联社',
  'Reuters World': '路透国际', 'CNN World': 'CNN 国际', 'Reuters US': '路透美国',
  'NPR News': 'NPR 新闻', 'Wall Street Journal': '华尔街日报',
  'BBC Middle East': 'BBC 中东', 'Al Jazeera': '半岛电视台', 'Al Arabiya': '阿拉伯卫视',
  'Hacker News': 'Hacker News', 'MIT Tech Review': 'MIT 科技评论',
  'VentureBeat AI': 'VentureBeat AI',
  'Defense One': '防务一号', 'Defense News': '防务新闻', 'Military Times': '军事时报',
  'Foreign Policy': '外交政策', 'Foreign Affairs': '外交事务',
  'Kitco News': 'Kitco 新闻', 'Kitco Gold': 'Kitco 黄金',
  'EIA Reports': 'EIA 报告', 'Reuters Energy': '路透能源',
  'Bellingcat': 'Bellingcat', 'CSIS': 'CSIS', 'RAND': '兰德',
  'Brookings': '布鲁金斯', 'Carnegie': '卡内基', 'FAO News': 'FAO 新闻',
  'BBC Russian': 'BBC 俄语', 'BBC Persian': 'BBC 波斯语', 'BBC Turkce': 'BBC 土耳其语',
  'France 24': '法国24', 'DW News': '德国之声', 'EuroNews': '欧洲新闻',
  'Kyiv Independent': '基辅独立报', 'Moscow Times': '莫斯科时报',
  'Nuclear Energy': '核能', 'Mining & Resources': '矿业与资源',
  'Chatham House': '查塔姆研究所', 'Atlantic Council': '大西洋理事会',
  'Nature News': '自然新闻', 'Live Science': '科学前沿', 'New Scientist': '新科学家',
  'CNBC Markets': 'CNBC 市场', 'CNBC Commodities': 'CNBC 大宗商品',
  'S&P Global Commodity': '标普全球大宗商品',
  'Seeking Alpha Metals': 'Seeking Alpha 金属',
  'Yahoo Finance Commodities': '雅虎财经大宗商品',
};

function translateSource(name: string): string {
  if (getCurrentLanguage() !== 'zh') return name;
  return SOURCE_ZH[name] || name;
}

function translateCategory(cat: string): string {
  if (getCurrentLanguage() !== 'zh') return cat.charAt(0).toUpperCase() + cat.slice(1);
  return CATEGORY_ZH[cat] || cat;
}

/** Threshold for enabling virtual scrolling */
const VIRTUAL_SCROLL_THRESHOLD = 15;

/** Summary cache TTL in milliseconds (10 minutes) */
const SUMMARY_CACHE_TTL = 10 * 60 * 1000;

/** Prepared cluster data for rendering */
interface PreparedCluster {
  cluster: ClusteredEvent;
  isNew: boolean;
  shouldHighlight: boolean;
  showNewTag: boolean;
}

export class NewsPanel extends Panel {
  private clusteredMode = true;
  private deviationEl: HTMLElement | null = null;
  private relatedAssetContext = new Map<string, RelatedAssetContext>();
  private onRelatedAssetClick?: (asset: RelatedAsset) => void;
  private onRelatedAssetsFocus?: (assets: RelatedAsset[], originLabel: string) => void;
  private onRelatedAssetsClear?: () => void;
  private isFirstRender = true;
  private windowedList: WindowedList<PreparedCluster> | null = null;
  private useVirtualScroll = true;
  private renderRequestId = 0;
  private boundScrollHandler: (() => void) | null = null;
  private boundClickHandler: (() => void) | null = null;

  // Sort mode toggle (#107)
  private sortMode!: SortMode;
  private sortBtn: HTMLButtonElement | null = null;
  private lastRawClusters: ClusteredEvent[] | null = null;
  private lastRawItems: NewsItem[] | null = null;

  // Panel summary feature
  private summaryBtn: HTMLButtonElement | null = null;
  private summaryContainer: HTMLElement | null = null;
  private currentHeadlines: string[] = [];
  private lastHeadlineSignature = '';
  private isSummarizing = false;

  constructor(id: string, title: string) {
    super({ id, title, showCount: true, trackActivity: true });
    this.sortMode = this.loadSortMode();
    this.createDeviationIndicator();
    this.createSortToggle();
    this.createSummarizeButton();
    this.setupActivityTracking();
    this.initWindowedList();
    this.setupContentDelegation();
  }

  private initWindowedList(): void {
    this.windowedList = new WindowedList<PreparedCluster>(
      {
        container: this.content,
        chunkSize: 8, // Render 8 items per chunk
        bufferChunks: 1, // 1 chunk buffer above/below
      },
      (prepared) => this.renderClusterHtmlSafely(
        prepared.cluster,
        prepared.isNew,
        prepared.shouldHighlight,
        prepared.showNewTag
      ),
      () => this.bindRelatedAssetEvents()
    );
  }

  private setupActivityTracking(): void {
    // Register with activity tracker
    activityTracker.register(this.panelId);

    // Listen for new count changes
    activityTracker.onChange(this.panelId, (newCount) => {
      // Pulse if there are new items
      this.setNewBadge(newCount, newCount > 0);
    });

    // Mark as seen when panel content is scrolled
    this.boundScrollHandler = () => {
      activityTracker.markAsSeen(this.panelId);
    };
    this.content.addEventListener('scroll', this.boundScrollHandler);

    // Mark as seen on click anywhere in panel
    this.boundClickHandler = () => {
      activityTracker.markAsSeen(this.panelId);
    };
    this.element.addEventListener('click', this.boundClickHandler);
  }

  public setRelatedAssetHandlers(options: {
    onRelatedAssetClick?: (asset: RelatedAsset) => void;
    onRelatedAssetsFocus?: (assets: RelatedAsset[], originLabel: string) => void;
    onRelatedAssetsClear?: () => void;
  }): void {
    this.onRelatedAssetClick = options.onRelatedAssetClick;
    this.onRelatedAssetsFocus = options.onRelatedAssetsFocus;
    this.onRelatedAssetsClear = options.onRelatedAssetsClear;
  }

  private createDeviationIndicator(): void {
    const header = this.getElement().querySelector('.panel-header-left');
    if (header) {
      this.deviationEl = document.createElement('span');
      this.deviationEl.className = 'deviation-indicator';
      header.appendChild(this.deviationEl);
    }
  }

  // --- Sort toggle (#107) ---
  private get sortStorageKey(): string {
    return `wm_sort_${SITE_VARIANT}_${this.panelId}`;
  }

  private loadSortMode(): SortMode {
    try {
      const v = localStorage.getItem(this.sortStorageKey);
      return v === 'newest' ? 'newest' : 'relevance';
    } catch { return 'relevance'; }
  }

  private saveSortMode(): void {
    try { localStorage.setItem(this.sortStorageKey, this.sortMode); } catch { /* storage full */ }
  }

  private createSortToggle(): void {
    this.sortBtn = document.createElement('button');
    this.sortBtn.className = 'panel-sort-btn';
    this.updateSortButtonLabel();
    this.sortBtn.addEventListener('click', () => {
      this.sortMode = this.sortMode === 'relevance' ? 'newest' : 'relevance';
      this.saveSortMode();
      this.updateSortButtonLabel();
      // Re-render with cached data
      if (this.lastRawClusters) {
        this.renderClusters(this.lastRawClusters);
      } else if (this.lastRawItems) {
        this.renderFlat(this.lastRawItems);
      }
    });

    const countEl = this.header.querySelector('.panel-count');
    if (countEl) {
      this.header.insertBefore(this.sortBtn, countEl);
    } else {
      this.header.appendChild(this.sortBtn);
    }
  }

  private updateSortButtonLabel(): void {
    if (!this.sortBtn) return;
    // SVG icons for cross-platform consistency
    const icon = this.sortMode === 'newest'
      ? '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><polyline points="8,4 8,8 11,10"/></svg>'
      : '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M4 7l4 4 4-4"/><line x1="3" y1="14" x2="13" y2="14"/></svg>';
    const label = this.sortMode === 'newest'
      ? t('components.newsPanel.sortNewest') || 'Newest'
      : t('components.newsPanel.sortRelevance') || 'Relevance';
    const tooltip = `${t('components.newsPanel.sortBy') || 'Sort by'}: ${label}`;
    this.sortBtn.innerHTML = icon;
    this.sortBtn.title = tooltip;
    this.sortBtn.setAttribute('aria-label', tooltip);
  }

  private createSummarizeButton(): void {
    // Create summary container (inserted between header and content)
    this.summaryContainer = document.createElement('div');
    this.summaryContainer.className = 'panel-summary';
    this.summaryContainer.style.display = 'none';
    this.element.insertBefore(this.summaryContainer, this.content);

    // Event delegation: handle close button clicks inside summaryContainer
    // regardless of how many times innerHTML is replaced by showSummary()
    this.summaryContainer.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.panel-summary-close')) {
        this.hideSummary();
      }
    });

    // Create summarize button
    this.summaryBtn = document.createElement('button');
    this.summaryBtn.className = 'panel-summarize-btn';
    this.summaryBtn.innerHTML = '✨';
    this.summaryBtn.title = t('components.newsPanel.summarize');
    this.summaryBtn.addEventListener('click', () => this.handleSummarize());

    // Insert before count element (use inherited this.header directly)
    const countEl = this.header.querySelector('.panel-count');
    if (countEl) {
      this.header.insertBefore(this.summaryBtn, countEl);
    } else {
      this.header.appendChild(this.summaryBtn);
    }
  }

  private async handleSummarize(): Promise<void> {
    if (this.isSummarizing || !this.summaryContainer || !this.summaryBtn) return;
    if (this.currentHeadlines.length === 0) return;

    // Check cache first (include variant, version, and language)
    const currentLang = getCurrentLanguage();
    const cacheKey = `panel_summary_v3_${SITE_VARIANT}_${this.panelId}_${currentLang}`;
    const cached = this.getCachedSummary(cacheKey);
    if (cached) {
      this.showSummary(cached);
      return;
    }

    // Show loading state
    this.isSummarizing = true;
    this.summaryBtn.innerHTML = '<span class="panel-summarize-spinner"></span>';
    this.summaryBtn.disabled = true;
    this.summaryContainer.style.display = 'block';
    this.summaryContainer.innerHTML = `<div class="panel-summary-loading">${t('components.newsPanel.generatingSummary')}</div>`;

    const sigAtStart = this.lastHeadlineSignature;

    try {
      const result = await generateSummary(this.currentHeadlines.slice(0, 8), undefined, this.panelId, currentLang);
      if (!this.element?.isConnected) return;
      if (this.lastHeadlineSignature !== sigAtStart) {
        this.hideSummary();
        return;
      }
      if (result?.summary) {
        this.setCachedSummary(cacheKey, result.summary);
        this.showSummary(result.summary);
      } else {
        this.summaryContainer.innerHTML = `<div class="panel-summary-error">${t('components.newsPanel.summaryError')}</div>`;
        setTimeout(() => this.hideSummary(), 3000);
      }
    } catch {
      if (!this.element?.isConnected) return;
      this.summaryContainer.innerHTML = `<div class="panel-summary-error">${t('components.newsPanel.summaryFailed')}</div>`;
      setTimeout(() => this.hideSummary(), 3000);
    } finally {
      this.isSummarizing = false;
      if (this.summaryBtn) {
        this.summaryBtn.innerHTML = '✨';
        this.summaryBtn.disabled = false;
      }
    }
  }

  private async handleTranslate(element: HTMLElement, text: string): Promise<void> {
    const currentLang = getCurrentLanguage();
    if (currentLang === 'en') return; // Assume news is mostly English, no need to translate if UI is English (or add detection later)

    const titleEl = element.closest('.item')?.querySelector('.item-title') as HTMLElement;
    if (!titleEl) return;

    const originalText = titleEl.textContent || '';

    // Visual feedback
    element.innerHTML = '...';
    element.style.pointerEvents = 'none';

    try {
      const translated = await translateText(text, currentLang);
      if (!this.element?.isConnected) return;
      if (translated) {
        titleEl.textContent = translated;
        titleEl.dataset.original = originalText;
        element.innerHTML = '✓';
        element.title = '原文: ' + originalText;
        element.classList.add('translated');
      } else {
        element.innerHTML = '文';
        // Shake animation or error state could be added here
      }
    } catch (e) {
      if (!this.element?.isConnected) return;
      console.error('Translation failed', e);
      element.innerHTML = '文';
    } finally {
      if (element.isConnected) {
        element.style.pointerEvents = 'auto';
      }
    }
  }

  private showSummary(summary: string): void {
    if (!this.summaryContainer || !this.element?.isConnected) return;
    this.summaryContainer.style.display = 'block';
    this.summaryContainer.innerHTML = `
      <div class="panel-summary-content">
        <span class="panel-summary-text">${escapeHtml(summary)}</span>
        <button class="panel-summary-close" title="${t('components.newsPanel.close')}" aria-label="${t('components.newsPanel.close')}">×</button>
      </div>
    `;
    // Close button click is handled via event delegation on summaryContainer (set up in constructor)
  }

  private hideSummary(): void {
    if (!this.summaryContainer) return;
    this.summaryContainer.style.display = 'none';
    this.summaryContainer.innerHTML = '';
  }

  private getHeadlineSignature(): string {
    return JSON.stringify(this.currentHeadlines.slice(0, 5).sort());
  }

  private updateHeadlineSignature(): void {
    const newSig = this.getHeadlineSignature();
    if (newSig !== this.lastHeadlineSignature) {
      this.lastHeadlineSignature = newSig;
      if (this.summaryContainer?.style.display === 'block') {
        this.hideSummary();
      }
    }
  }

  private getCachedSummary(key: string): string | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (!parsed.headlineSignature) { localStorage.removeItem(key); return null; }
      if (parsed.headlineSignature !== this.lastHeadlineSignature) return null;
      if (Date.now() - parsed.timestamp > SUMMARY_CACHE_TTL) { localStorage.removeItem(key); return null; }
      return parsed.summary;
    } catch {
      return null;
    }
  }

  private setCachedSummary(key: string, summary: string): void {
    try {
      localStorage.setItem(key, JSON.stringify({
        headlineSignature: this.lastHeadlineSignature,
        summary,
        timestamp: Date.now(),
      }));
    } catch { /* storage full */ }
  }

  public setDeviation(zScore: number, percentChange: number, level: DeviationLevel): void {
    if (!this.deviationEl) return;

    if (level === 'normal') {
      this.deviationEl.textContent = '';
      this.deviationEl.className = 'deviation-indicator';
      return;
    }

    const arrow = zScore > 0 ? '↑' : '↓';
    const sign = percentChange > 0 ? '+' : '';
    this.deviationEl.textContent = `${arrow}${sign}${percentChange}%`;
    this.deviationEl.className = `deviation-indicator ${level}`;
    this.deviationEl.title = `z-score: ${zScore} (vs 7-day avg)`;
  }

  public override showError(message?: string, onRetry?: () => void, autoRetrySeconds?: number): void {
    this.lastRawClusters = null;
    this.lastRawItems = null;
    super.showError(message, onRetry, autoRetrySeconds);
  }

  public renderNews(items: NewsItem[]): void {
    if (items.length === 0) {
      this.renderRequestId += 1; // Cancel in-flight clustering from previous renders.
      this.setDataBadge('unavailable');
      this.showError(t('common.noNewsAvailable'));
      return;
    }

    this.setDataBadge('live');

    // Always show flat items immediately for instant visual feedback,
    // then upgrade to clustered view in the background when ready.
    this.renderFlat(items);

    if (this.clusteredMode) {
      void this.renderClustersAsync(items);
    }
  }

  public renderFilteredEmpty(message: string): void {
    this.renderRequestId += 1; // Cancel in-flight clustering from previous renders.
    this.lastRawClusters = null;
    this.lastRawItems = null;
    this.setDataBadge('live');
    this.setCount(0);
    this.relatedAssetContext.clear();
    this.currentHeadlines = [];
    this.updateHeadlineSignature();
    this.setContent(`<div class="panel-empty">${escapeHtml(message)}</div>`);
  }

  private async renderClustersAsync(items: NewsItem[]): Promise<void> {
    const requestId = ++this.renderRequestId;

    try {
      const clusters = await analysisWorker.clusterNews(items);
      if (requestId !== this.renderRequestId) return;
      const enriched = await enrichWithVelocityML(clusters);
      this.renderClusters(enriched);
    } catch (error) {
      if (requestId !== this.renderRequestId) return;
      // Keep already-rendered flat list visible when clustering fails.
      console.warn('[NewsPanel] Failed to cluster news, keeping flat list:', error);
    }
  }

  private renderFlat(items: NewsItem[]): void {
    this.lastRawItems = items;

    let sorted: NewsItem[];
    if (this.sortMode === 'newest') {
      sorted = [...items].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    } else {
      sorted = items;
    }

    this.setCount(sorted.length);
    this.currentHeadlines = sorted
      .slice(0, 5)
      .map(item => item.title)
      .filter((title): title is string => typeof title === 'string' && title.trim().length > 0);

    this.updateHeadlineSignature();

    const html = sorted
      .map(
        (item) => `
      <div class="item ${item.isAlert ? 'alert' : ''}" ${item.monitorColor ? `style="border-inline-start-color: ${escapeHtml(item.monitorColor)}"` : ''}>
        <div class="item-source">
          ${escapeHtml(translateSource(item.source))}
          ${item.lang && item.lang !== getCurrentLanguage() ? `<span class="lang-badge">${item.lang.toUpperCase()}</span>` : ''}
          ${item.isAlert ? `<span class="alert-tag">${getCurrentLanguage() === 'zh' ? '警报' : 'ALERT'}</span>` : ''}
        </div>
        <a class="item-title" href="${sanitizeUrl(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
        <div class="item-time">
          ${formatTime(item.pubDate)}
          ${getCurrentLanguage() !== 'en' ? `<button class="item-translate-btn" title="Translate" data-text="${escapeHtml(item.title)}">文</button>` : ''}
        </div>
      </div>
    `
      )
      .join('');

    this.setContent(html);
  }

  private renderClusters(clusters: ClusteredEvent[]): void {
    this.lastRawClusters = clusters;
    this.lastRawItems = null;

    // Sort based on user preference (#107)
    const sorted = [...clusters].sort((a, b) => {
      if (this.sortMode === 'newest') {
        // Pure chronological, newest first
        return b.lastUpdated.getTime() - a.lastUpdated.getTime();
      }
      // Default: threat priority first, then recency within same level
      const pa = THREAT_PRIORITY[a.threat?.level ?? 'info'];
      const pb = THREAT_PRIORITY[b.threat?.level ?? 'info'];
      if (pb !== pa) return pb - pa;
      return b.lastUpdated.getTime() - a.lastUpdated.getTime();
    });

    const totalItems = sorted.reduce((sum, c) => sum + c.sourceCount, 0);
    this.setCount(totalItems);
    this.relatedAssetContext.clear();

    // Store headlines for summarization (cap at 5 to reduce entity conflation in small models)
    this.currentHeadlines = sorted.slice(0, 5).map(c => c.primaryTitle);

    this.updateHeadlineSignature();

    const clusterIds = sorted.map(c => c.id);
    let newItemIds: Set<string>;

    if (this.isFirstRender) {
      // First render: mark all items as seen
      activityTracker.updateItems(this.panelId, clusterIds);
      activityTracker.markAsSeen(this.panelId);
      newItemIds = new Set();
      this.isFirstRender = false;
    } else {
      // Subsequent renders: track new items
      const newIds = activityTracker.updateItems(this.panelId, clusterIds);
      newItemIds = new Set(newIds);
    }

    // Prepare all clusters with their rendering data (defer HTML creation)
    const prepared: PreparedCluster[] = sorted.map(cluster => {
      const isNew = newItemIds.has(cluster.id);
      const shouldHighlight = activityTracker.shouldHighlight(this.panelId, cluster.id);
      const showNewTag = activityTracker.isNewItem(this.panelId, cluster.id) && isNew;

      return {
        cluster,
        isNew,
        shouldHighlight,
        showNewTag,
      };
    });

    // Use windowed rendering for large lists, direct render for small
    if (this.useVirtualScroll && sorted.length > VIRTUAL_SCROLL_THRESHOLD && this.windowedList) {
      this.windowedList.setItems(prepared);
    } else {
      // Direct render for small lists
      const html = prepared
        .map(p => this.renderClusterHtmlSafely(p.cluster, p.isNew, p.shouldHighlight, p.showNewTag))
        .join('');
      this.setContent(html);
    }
  }

  private renderClusterHtmlSafely(
    cluster: ClusteredEvent,
    isNew: boolean,
    shouldHighlight: boolean,
    showNewTag: boolean
  ): string {
    try {
      return this.renderClusterHtml(cluster, isNew, shouldHighlight, showNewTag);
    } catch (error) {
      console.error('[NewsPanel] Failed to render cluster card:', error, cluster);
      const clusterId = typeof cluster?.id === 'string' ? cluster.id : 'unknown-cluster';
      return `
        <div class="item clustered item-render-error" data-cluster-id="${escapeHtml(clusterId)}">
          <div class="item-source">${t('common.error')}</div>
          <div class="item-title">Failed to display this cluster.</div>
        </div>
      `;
    }
  }

  /**
   * Render a single cluster to HTML string
   */
  private renderClusterHtml(
    cluster: ClusteredEvent,
    isNew: boolean,
    shouldHighlight: boolean,
    showNewTag: boolean
  ): string {
    const sourceBadge = cluster.sourceCount > 1
      ? `<span class="source-count">${t('components.newsPanel.sources', { count: String(cluster.sourceCount) })}</span>`
      : '';

    const velocity = cluster.velocity;
    const velocityBadge = velocity && velocity.level !== 'normal' && cluster.sourceCount > 1
      ? `<span class="velocity-badge ${velocity.level}">${velocity.trend === 'rising' ? '↑' : ''}+${velocity.sourcesPerHour}/hr</span>`
      : '';

    const sentimentIcon = velocity?.sentiment === 'negative' ? '⚠' : velocity?.sentiment === 'positive' ? '✓' : '';
    const sentimentBadge = sentimentIcon && Math.abs(velocity?.sentimentScore || 0) > 2
      ? `<span class="sentiment-badge ${velocity?.sentiment}">${sentimentIcon}</span>`
      : '';

    const newTag = showNewTag ? `<span class="new-tag">${t('common.new')}</span>` : '';
    const langBadge = cluster.lang && cluster.lang !== getCurrentLanguage()
      ? `<span class="lang-badge">${cluster.lang.toUpperCase()}</span>`
      : '';

    // Propaganda risk indicator for primary source
    const primaryPropRisk = getSourcePropagandaRisk(cluster.primarySource);
    const primaryPropBadge = primaryPropRisk.risk !== 'low'
      ? `<span class="propaganda-badge ${primaryPropRisk.risk}" title="${escapeHtml(primaryPropRisk.note || (getCurrentLanguage() === 'zh' ? `国家关联: ${primaryPropRisk.stateAffiliated || '未知'}` : `State-affiliated: ${primaryPropRisk.stateAffiliated || 'Unknown'}`))}">${primaryPropRisk.risk === 'high' ? (getCurrentLanguage() === 'zh' ? '⚠ 官方媒体' : '⚠ State Media') : (getCurrentLanguage() === 'zh' ? '! 注意' : '! Caution')}</span>`
      : '';

    // Source credibility badge for primary source (T1=Wire, T2=Verified outlet)
    const primaryTier = getSourceTier(cluster.primarySource);
    const primaryType = getSourceType(cluster.primarySource);
    const tierLabel = primaryTier === 1 ? (getCurrentLanguage() === 'zh' ? '通讯社' : 'Wire') : '';
    const tierBadge = primaryTier <= 2
      ? `<span class="tier-badge tier-${primaryTier}" title="${primaryType === 'wire' ? (getCurrentLanguage() === 'zh' ? '通讯社 - 最高可信度' : 'Wire Service - Highest reliability') : primaryType === 'gov' ? (getCurrentLanguage() === 'zh' ? '官方政府来源' : 'Official Government Source') : (getCurrentLanguage() === 'zh' ? '认证新闻媒体' : 'Verified News Outlet')}">${primaryTier === 1 ? '★' : '●'}${tierLabel ? ` ${tierLabel}` : ''}</span>`
      : '';

    // Build "Also reported by" section for multi-source confirmation
    const otherSources = cluster.topSources.filter(s => s.name !== cluster.primarySource);
    const topSourcesHtml = otherSources.length > 0
      ? `<span class="also-reported">${getCurrentLanguage() === 'zh' ? '其他来源报道:' : 'Also:'}</span>` + otherSources
        .map(s => {
          const propRisk = getSourcePropagandaRisk(s.name);
          const propBadge = propRisk.risk !== 'low'
            ? `<span class="propaganda-badge ${propRisk.risk}" title="${escapeHtml(propRisk.note || (getCurrentLanguage() === 'zh' ? `国家关联: ${propRisk.stateAffiliated || '未知'}` : `State-affiliated: ${propRisk.stateAffiliated || 'Unknown'}`))}">${propRisk.risk === 'high' ? '⚠' : '!'}</span>`
            : '';
          return `<span class="top-source tier-${s.tier}">${escapeHtml(s.name)}${propBadge}</span>`;
        })
        .join('')
      : '';

    const assetContext = getClusterAssetContext(cluster);
    if (assetContext && assetContext.assets.length > 0) {
      this.relatedAssetContext.set(cluster.id, assetContext);
    }

    const relatedAssetsHtml = assetContext && assetContext.assets.length > 0
      ? `
        <div class="related-assets" data-cluster-id="${escapeHtml(cluster.id)}">
          <div class="related-assets-header">
            ${t('components.newsPanel.relatedAssetsNear', { location: escapeHtml(assetContext.origin.label) })}
            <span class="related-assets-range">(${MAX_DISTANCE_KM}km)</span>
          </div>
          <div class="related-assets-list">
            ${assetContext.assets.map(asset => `
              <button class="related-asset" data-cluster-id="${escapeHtml(cluster.id)}" data-asset-id="${escapeHtml(asset.id)}" data-asset-type="${escapeHtml(asset.type)}">
                <span class="related-asset-type">${escapeHtml(this.getLocalizedAssetLabel(asset.type))}</span>
                <span class="related-asset-name">${escapeHtml(asset.name)}</span>
                <span class="related-asset-distance">${Math.round(asset.distanceKm)}km</span>
              </button>
            `).join('')}
          </div>
        </div>
      `
      : '';

    // Category tag from threat classification
    const cat = cluster.threat?.category;
    const catLabel = cat && cat !== 'general' ? translateCategory(cat) : '';
    const threatVarMap: Record<string, string> = { critical: '--threat-critical', high: '--threat-high', medium: '--threat-medium', low: '--threat-low', info: '--threat-info' };
    const catColor = cluster.threat ? getCSSColor(threatVarMap[cluster.threat.level] || '--text-dim') : '';
    const categoryBadge = catLabel
      ? `<span class="category-tag" style="color:${catColor};border-color:${catColor}40;background:${catColor}20">${catLabel}</span>`
      : '';

    // Build class list for item
    const itemClasses = [
      'item',
      'clustered',
      cluster.isAlert ? 'alert' : '',
      shouldHighlight ? 'item-new-highlight' : '',
      isNew ? 'item-new' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="${itemClasses}" ${cluster.monitorColor ? `style="border-inline-start-color: ${escapeHtml(cluster.monitorColor)}"` : ''} data-cluster-id="${escapeHtml(cluster.id)}" data-news-id="${escapeHtml(cluster.primaryLink)}">
        <div class="item-source">
          ${tierBadge}
          ${escapeHtml(translateSource(cluster.primarySource))}
          ${primaryPropBadge}
          ${langBadge}
          ${newTag}
          ${sourceBadge}
          ${velocityBadge}
          ${sentimentBadge}
          ${cluster.isAlert ? `<span class="alert-tag">${getCurrentLanguage() === 'zh' ? '警报' : 'ALERT'}</span>` : ''}
          ${categoryBadge}
        </div>
        <a class="item-title" href="${sanitizeUrl(cluster.primaryLink)}" target="_blank" rel="noopener">${escapeHtml(cluster.primaryTitle)}</a>
        <div class="cluster-meta">
          <span class="top-sources">${topSourcesHtml}</span>
          <span class="item-time">${formatTime(cluster.lastUpdated)}</span>
          ${getCurrentLanguage() !== 'en' ? `<button class="item-translate-btn" title="Translate" data-text="${escapeHtml(cluster.primaryTitle)}">文</button>` : ''}
        </div>
        ${relatedAssetsHtml}
      </div>
    `;
  }

  private setupContentDelegation(): void {
    this.content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const assetBtn = target.closest<HTMLElement>('.related-asset');
      if (assetBtn) {
        e.stopPropagation();
        const clusterId = assetBtn.dataset.clusterId;
        const assetId = assetBtn.dataset.assetId;
        const assetType = assetBtn.dataset.assetType as RelatedAsset['type'] | undefined;
        if (!clusterId || !assetId || !assetType) return;
        const context = this.relatedAssetContext.get(clusterId);
        const asset = context?.assets.find(item => item.id === assetId && item.type === assetType);
        if (asset) this.onRelatedAssetClick?.(asset);
        return;
      }

      const translateBtn = target.closest<HTMLElement>('.item-translate-btn');
      if (translateBtn) {
        e.stopPropagation();
        const text = translateBtn.dataset.text;
        if (text) this.handleTranslate(translateBtn, text);
        return;
      }
    });

    this.content.addEventListener('mouseover', (e) => {
      const container = (e.target as HTMLElement).closest<HTMLElement>('.related-assets');
      if (!container) return;
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (related && container.contains(related)) return;
      const context = this.relatedAssetContext.get(container.dataset.clusterId ?? '');
      if (context) this.onRelatedAssetsFocus?.(context.assets, context.origin.label);
    });

    this.content.addEventListener('mouseout', (e) => {
      const container = (e.target as HTMLElement).closest<HTMLElement>('.related-assets');
      if (!container) return;
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (related && container.contains(related)) return;
      this.onRelatedAssetsClear?.();
    });
  }

  private bindRelatedAssetEvents(): void {
    // Event delegation is set up in setupContentDelegation() — this is now a no-op
    // kept for WindowedList callback compatibility
  }

  private getLocalizedAssetLabel(type: RelatedAsset['type']): string {
    const keyMap: Record<RelatedAsset['type'], string> = {
      pipeline: 'modals.countryBrief.infra.pipeline',
      cable: 'modals.countryBrief.infra.cable',
      datacenter: 'modals.countryBrief.infra.datacenter',
      base: 'modals.countryBrief.infra.base',
      nuclear: 'modals.countryBrief.infra.nuclear',
    };
    return t(keyMap[type]);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Clean up windowed list
    this.windowedList?.destroy();
    this.windowedList = null;

    // Remove activity tracking listeners
    if (this.boundScrollHandler) {
      this.content.removeEventListener('scroll', this.boundScrollHandler);
      this.boundScrollHandler = null;
    }
    if (this.boundClickHandler) {
      this.element.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }

    // Unregister from activity tracker
    activityTracker.unregister(this.panelId);

    // Call parent destroy
    super.destroy();
  }
}
