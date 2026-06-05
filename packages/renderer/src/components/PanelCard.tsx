import type { ReactNode } from 'react';

import { Card } from '@chakra-ui/react';

type PanelCardProps = {
  children: ReactNode;
};

export function PanelCard({ children }: PanelCardProps) {
  return (
    <Card.Root
      bg="surface.panel"
      borderWidth="1px"
      borderColor="brand.glow"
      boxShadow="0 0 40px rgba(168, 85, 247, 0.06)"
      borderRadius="xl"
    >
      <Card.Body>{children}</Card.Body>
    </Card.Root>
  );
}
