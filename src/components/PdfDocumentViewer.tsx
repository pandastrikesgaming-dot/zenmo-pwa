import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

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

export function PdfDocumentViewer({
  fileUrl,
  height,
  onLoadComplete,
  onPageChanged,
  width,
}: PdfDocumentViewerProps) {
  useEffect(() => {
    // With an iframe, we don't have direct access to the internal page count easily across origins.
    // We notify that the document is loaded with 1 page minimum.
    onLoadComplete?.(1);
    onPageChanged?.(1);
  }, [onLoadComplete, onPageChanged]);

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
      <iframe
        src={`${fileUrl}#view=FitH&toolbar=1&navpanes=0`}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="PDF Document Viewer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090706',
    overflow: 'hidden',
  },
});
