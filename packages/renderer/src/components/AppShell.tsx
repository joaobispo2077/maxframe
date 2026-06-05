import type { ReactNode } from 'react';

import { Box, Container, VStack } from '@chakra-ui/react';

import { PageHeader } from './PageHeader.js';
import { PanelCard } from './PanelCard.js';

type AppShellProps = {
  isPortable: boolean;
  subtitle: string;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  isPortable,
  subtitle,
  headerActions,
  children,
}: AppShellProps) {
  return (
    <Box minH="100vh" py={{ base: 6, md: 10 }} px={4}>
      <Container maxW="960px">
        <PanelCard>
          <VStack gap={6} align="stretch">
            <PageHeader isPortable={isPortable} subtitle={subtitle} />
            {headerActions}
            {children}
          </VStack>
        </PanelCard>
      </Container>
    </Box>
  );
}
