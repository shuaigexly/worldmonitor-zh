import { CorrelationPanel } from './CorrelationPanel';
import { t, getCurrentLanguage } from '@/services/i18n';

export class EconomicCorrelationPanel extends CorrelationPanel {
  constructor() {
    super('economic-correlation', getCurrentLanguage() === 'zh' ? '经济战' : 'Economic Warfare', 'economic', t('components.economicCorrelation.infoTooltip'));
  }
}
