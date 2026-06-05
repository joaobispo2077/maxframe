import { Button, HStack } from '@chakra-ui/react';

import type { AppTab } from '../hooks/useAppNavigation.js';

const TABS: { id: AppTab; label: string }[] = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'queue', label: 'Queue' },
  { id: 'settings', label: 'Settings' },
];

type AppNavProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};

export function AppNav({ activeTab, onChange }: AppNavProps) {
  return (
    <HStack gap={2} role="tablist" aria-label="Main navigation" flexWrap="wrap">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          variant={activeTab === tab.id ? 'solid' : 'ghost'}
          colorPalette="purple"
          size="sm"
          cursor="pointer"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </HStack>
  );
}
