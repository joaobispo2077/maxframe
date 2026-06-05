import { Button, HStack, Image } from '@chakra-ui/react';

import maxframeLogoIcon from '../../../../.github/assets/maxframe-logo-icon.png';
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
    <HStack gap={3} role="tablist" aria-label="Main navigation" flexWrap="wrap">
      <Button
        type="button"
        variant="ghost"
        aria-label="Go to homepage"
        p={1}
        minW="auto"
        h="auto"
        cursor="pointer"
        onClick={() => onChange('analyze')}
      >
        <Image
          src={maxframeLogoIcon}
          alt=""
          aria-hidden
          boxSize="28px"
          borderRadius="md"
          flexShrink={0}
        />
      </Button>
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
