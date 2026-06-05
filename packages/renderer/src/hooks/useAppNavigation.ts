import { useState } from 'react';

export type AppTab = 'analyze' | 'queue' | 'settings';

export function useAppNavigation(initialTab: AppTab = 'analyze') {
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);

  return { activeTab, setActiveTab };
}
