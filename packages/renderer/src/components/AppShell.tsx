import type { ReactNode } from 'react';

import { Box, Container, VStack } from '@chakra-ui/react';

import { PageHeader } from './PageHeader.js';
import { PanelCard } from './PanelCard.js';
import { TitleBar } from './TitleBar.js';

import type { TitleBarInset } from './TitleBar.js';

type AppShellProps = {
  isPortable: boolean;
  subtitle: string;
  titleBarInset?: TitleBarInset;
  onGoHome?: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  isPortable,
  subtitle,
  titleBarInset = { height: 0, padLeft: 0, padRight: 0 },
  onGoHome,
  headerActions,
  children,
}: AppShellProps) {
  return (
    <Box minH="100vh" bg="surface.canvas">
      <TitleBar {...titleBarInset} />
      <Box
        pt={titleBarInset.height > 0 ? `${titleBarInset.height}px` : undefined}
        py={{ base: 6, md: 10 }}
        px={4}
      >
        <Container maxW="960px">
          <PanelCard>
            <VStack gap={6} align="stretch">
              <PageHeader
                isPortable={isPortable}
                subtitle={subtitle}
                onGoHome={onGoHome}
              />
              {headerActions}
              {children}
            </VStack>
          </PanelCard>
        </Container>
      </Box>
    </Box>
  );
}
