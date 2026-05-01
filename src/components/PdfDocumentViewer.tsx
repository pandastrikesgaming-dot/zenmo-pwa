import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme';

type PdfDocumentViewerProps = {
  accentColor: string;
  currentPage?: number;
  fileUrl: string;
  height?: number;
  onError?: (message: string) => void;
  onInteraction?: () => void;
  onLoadComplete?: (pageCount: number) => void;
  onPageChanged?: (pageNumber: number) => void;
  onScaleChanged?: (scale: number) => void;
  onSingleTap?: () => void;
  scale?: number;
  width?: number;
};

const MAX_VIEWER_SCALE = 4;
const MIN_VIEWER_SCALE = 0.5;

function clampViewerScale(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(value, MIN_VIEWER_SCALE), MAX_VIEWER_SCALE);
}

function isMobileBrowser() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function canUseExternalEmbeddedViewer(fileUrl: string) {
  return /^https?:\/\//i.test(fileUrl);
}

function buildDirectPdfViewerUrl(fileUrl: string) {
  if (fileUrl.includes('#')) {
    return fileUrl;
  }

  return `${fileUrl}#toolbar=1&navpanes=0&view=FitH`;
}

function buildPdfViewerUrl(fileUrl: string) {
  if (isMobileBrowser() && canUseExternalEmbeddedViewer(fileUrl)) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(fileUrl)}`;
  }

  return buildDirectPdfViewerUrl(fileUrl);
}

function getFrameShellStyle(scale: number): CSSProperties {
  const normalizedScale = clampViewerScale(scale);
  const scaledPercent = `${Math.max(normalizedScale * 100, 100)}%`;

  return {
    height: scaledPercent,
    minHeight: '100%',
    minWidth: '100%',
    width: scaledPercent,
  };
}

export function PdfDocumentViewer({
  accentColor,
  fileUrl,
  height,
  onError,
  onInteraction,
  onSingleTap,
  scale = 1,
  width,
}: PdfDocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const viewerUrl = useMemo(() => buildPdfViewerUrl(fileUrl), [fileUrl]);
  const frameShellStyle = useMemo(() => getFrameShellStyle(scale), [scale]);

  useEffect(() => {
    setIsLoading(true);
    onError?.('');

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [fileUrl, onError]);

  function handleLoad() {
    setIsLoading(false);
    onError?.('');
  }

  function handleError() {
    setIsLoading(false);
    onError?.('PDF preview failed. Please refresh and try again.');
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: width ?? '100%',
          height: height ?? '100%',
        },
      ]}
    >
      <div
        onClick={onSingleTap}
        onMouseMove={onInteraction}
        onScroll={onInteraction}
        onTouchStart={onInteraction}
        style={scrollStyle}
      >
        <div style={frameShellStyle}>
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            onError={handleError}
            onLoad={handleLoad}
            style={frameStyle}
            title="PDF preview"
          />
        </div>
      </div>

      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={accentColor} />
          <Text style={styles.stateText}>Loading PDF...</Text>
        </View>
      ) : null}
    </View>
  );
}

const scrollStyle: CSSProperties = {
  boxSizing: 'border-box',
  height: '100%',
  overflowX: 'auto',
  overflowY: 'auto',
  padding: '130px 14px 260px',
  WebkitOverflowScrolling: 'touch',
  width: '100%',
};

const frameStyle: CSSProperties = {
  backgroundColor: '#090706',
  border: '0',
  display: 'block',
  height: '100%',
  minHeight: '100%',
  width: '100%',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090706',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(9, 7, 6, 0.72)',
    padding: 24,
  },
  stateText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
});
