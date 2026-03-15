import { CorrelationPanel } from './CorrelationPanel';
import { t, getCurrentLanguage } from '@/services/i18n';

export class EscalationCorrelationPanel extends CorrelationPanel {
  constructor() {
    super('escalation-correlation', getCurrentLanguage() === 'zh' ? '升级监控' : 'Escalation Monitor', 'escalation', t('components.escalationCorrelation.infoTooltip'));
  }
}
