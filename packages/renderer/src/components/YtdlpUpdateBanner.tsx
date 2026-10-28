import type { YtdlpUpdateView } from '@src/domain/ytdlp/ytdlpUpdateView.js';

import { Box, Button, HStack, Text } from '@chakra-ui/react';
import {
  YTDLP_NOT_NOW_BUTTON,
  YTDLP_TRY_AGAIN_BUTTON,
  YTDLP_UPDATE_BUTTON,
  YTDLP_UPDATING_BUTTON,
  ytdlpNoticeMessage,
  ytdlpUpdatingLiveMessage,
} from '@src/domain/ytdlp/ytdlpUpdateCopy.js';

type YtdlpUpdateBannerProps = {
  view: YtdlpUpdateView | undefined;
  blocked: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  onCheck: () => void;
};

export function YtdlpUpdateBanner({
  view,
  blocked,
  onUpdate,
  onDismiss,
  onCheck,
}: YtdlpUpdateBannerProps) {
  if (!view || view.phase === 'idle') {
    return null;
  }
  const updating = view.phase === 'updating';
  const message = updating ? undefined : ytdlpNoticeMessage(view);
  if (!updating && !message) {
    return null;
  }
  const held = blocked || !view.updateAllowed || updating;
  return (
    <Box data-testid="ytdlp-update-banner">
      {message ? (
        <Text role={alertRole(view.phase)} color={textColor(view.phase)}>
          {message}
        </Text>
      ) : null}
      <Box
        aria-live="polite"
        aria-atomic="true"
        data-testid="ytdlp-update-live"
        fontSize="sm"
        color="fg.muted"
        mt={1}
      >
        {updating && view.latest ? ytdlpUpdatingLiveMessage(view.latest) : ''}
      </Box>
      <YtdlpUpdateActions
        phase={view.phase}
        held={held}
        onUpdate={onUpdate}
        onDismiss={onDismiss}
        onCheck={onCheck}
      />
    </Box>
  );
}

function alertRole(phase: YtdlpUpdateView['phase']): 'alert' | 'status' {
  if (
    phase === 'error-network' ||
    phase === 'error-checksum' ||
    phase === 'error-write' ||
    phase === 'check-failed' ||
    phase === 'fallback'
  ) {
    return 'alert';
  }
  return 'status';
}

function textColor(phase: YtdlpUpdateView['phase']): string {
  if (phase === 'success' || phase === 'up-to-date') {
    return 'green.300';
  }
  if (alertRole(phase) === 'alert') {
    return 'orange.300';
  }
  return 'fg';
}

function YtdlpUpdateActions({
  phase,
  held,
  onUpdate,
  onDismiss,
  onCheck,
}: {
  phase: YtdlpUpdateView['phase'];
  held: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  onCheck: () => void;
}) {
  if (phase === 'outdated' || phase === 'fallback') {
    return (
      <HStack gap={2} mt={2}>
        <UpdateButton
          held={held}
          label={YTDLP_UPDATE_BUTTON}
          onClick={onUpdate}
        />
        {phase === 'outdated' ? (
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            {YTDLP_NOT_NOW_BUTTON}
          </Button>
        ) : null}
      </HStack>
    );
  }
  if (phase === 'updating') {
    return (
      <HStack gap={2} mt={2}>
        <UpdateButton held label={YTDLP_UPDATING_BUTTON} onClick={onUpdate} />
      </HStack>
    );
  }
  if (
    phase === 'error-network' ||
    phase === 'error-checksum' ||
    phase === 'error-write'
  ) {
    return (
      <HStack gap={2} mt={2}>
        <UpdateButton
          held={held}
          label={YTDLP_TRY_AGAIN_BUTTON}
          onClick={onUpdate}
        />
      </HStack>
    );
  }
  if (phase === 'check-failed') {
    return (
      <HStack gap={2} mt={2}>
        <UpdateButton
          held={held}
          label={YTDLP_TRY_AGAIN_BUTTON}
          onClick={onCheck}
        />
      </HStack>
    );
  }
  return null;
}

function UpdateButton({
  held,
  label,
  onClick,
}: {
  held: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      colorPalette="purple"
      aria-disabled={held || undefined}
      onClick={() => {
        if (held) {
          return;
        }
        onClick();
      }}
    >
      {label}
    </Button>
  );
}
