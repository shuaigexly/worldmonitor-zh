import { CorrelationPanel } from './CorrelationPanel';
import { getCurrentLanguage } from '@/services/i18n';

export class DisasterCorrelationPanel extends CorrelationPanel {
  constructor() {
    super('disaster-correlation', getCurrentLanguage() === 'zh' ? '灾害连锁' : 'Disaster Cascade', 'disaster');
  }
}
