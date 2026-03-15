import { CorrelationPanel } from './CorrelationPanel';
import { getCurrentLanguage } from '@/services/i18n';

export class MilitaryCorrelationPanel extends CorrelationPanel {
  constructor() {
    super('military-correlation', getCurrentLanguage() === 'zh' ? '军力态势' : 'Force Posture', 'military');
  }
}
