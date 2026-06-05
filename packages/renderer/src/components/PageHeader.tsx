import { Badge, Button, Heading, Image, Text, VStack } from '@chakra-ui/react';

import maxframeLogo from '../../../../.github/assets/maxframe-logo.png';

type PageHeaderProps = {
  isPortable: boolean;
  subtitle: string;
  onGoHome?: () => void;
};

export function PageHeader({ isPortable, subtitle, onGoHome }: PageHeaderProps) {
  const logo = (
    <Image
      src={maxframeLogo}
      alt="Maxframe logo"
      boxSize="96px"
      mx="auto"
      objectFit="contain"
    />
  );

  return (
    <VStack gap={3} textAlign="center">
      {onGoHome ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onGoHome}
          aria-label="Go to homepage"
          cursor="pointer"
          bg="transparent"
          border="none"
          p={0}
          mx="auto"
          minW="auto"
          h="auto"
          transition="opacity 0.2s"
          _hover={{ opacity: 0.85 }}
        >
          {logo}
        </Button>
      ) : (
        logo
      )}
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
