import { Badge, Heading, Image, Text, VStack } from '@chakra-ui/react';

import maxframeLogo from '../../../../.github/assets/maxframe-logo.png';

type PageHeaderProps = {
  isPortable: boolean;
  subtitle: string;
};

export function PageHeader({ isPortable, subtitle }: PageHeaderProps) {
  return (
    <VStack gap={3} textAlign="center">
      <Image
        src={maxframeLogo}
        alt="Maxframe logo"
        boxSize="96px"
        mx="auto"
        objectFit="contain"
      />
      <Heading size="xl" letterSpacing="tight">
        Maxframe
      </Heading>
      {isPortable ? (
        <Badge colorPalette="purple" variant="subtle" size="sm">
          Portable
        </Badge>
      ) : null}
      <Text fontSize="lg" color="fg.muted">
        {subtitle}
      </Text>
    </VStack>
  );
}
