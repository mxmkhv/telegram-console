import React, { memo } from 'react';
import { Text } from 'ink';
import type { MediaAttachment } from '../types/index.js';
import { formatMediaMetadata } from '../services/imageRenderer.js';

interface Props {
  media: MediaAttachment;
  messageId: number;
}

export const MediaPlaceholder = memo(function MediaPlaceholder({
  media,
  messageId,
}: Props) {
  const metadata = formatMediaMetadata(media, messageId);
  return <Text dimColor>{metadata}</Text>;
});
