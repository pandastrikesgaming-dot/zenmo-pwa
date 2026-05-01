import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

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

type PdfDocumentProxy = {
  destroy?: () => Promise<void>;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  numPages: number;
};

type PdfPageProxy = {
  getViewport: (options: { scale: number }) => { height: number; width: number };
  render: (options: {
    canvas?: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    transform?: number[];
    viewport: { height: number; width: number };
  }) => {
    cancel?: () => void;
    promise: Promise<void>;
  };
};

type PdfLoadingTask = {
  destroy?: () => Promise<void>;
  promise: Promise<PdfDocumentProxy>;
};

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (options: Record<string, unknown>) => PdfLoadingTask;
};

const MAX_RENDER_SCALE = 4;
const MIN_RENDER_SCALE = 0.2;

function isCancelError(error: unknown) {
  return error instanceof Error && error.name === 'RenderingCancelledException';
}

function clampRenderScale(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(value, MIN_RENDER_SCALE), MAX_RENDER_SCALE);
}

function getPdfWorkerSrc() {
  if (typeof window === 'undefined') {
    return '/pdf.worker.min.mjs';
  }

  return new URL('/pdf.worker.min.mjs', window.location.origin).toString();
}

async function loadPdfDocument(pdfjs: PdfJsModule, fileUrl: string) {
  const directTask = pdfjs.getDocument({
    disableAutoFetch: true,
    disableRange: true,
    disableStream: true,
    url: fileUrl,
    withCredentials: false,
  });

  try {
    return await directTask.promise;
  } catch (directError) {
    await directTask.destroy?.();

    if (fileUrl.startsWith('blob:')) {
      throw directError;
    }

    console.warn('[PdfDocumentViewer] url load failed; retrying with full PDF bytes', directError);
    const response = await fetch(fileUrl, {
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`Unable to fetch PDF bytes (${response.status}).`);
    }

    const buffer = await response.arrayBuffer();
    const byteTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableAutoFetch: true,
      disableRange: true,
      disableStream: true,
    });

    return byteTask.promise;
  }
}

function getBrowserPreviewShellStyle(scale: number): CSSProperties {
  const normalizedScale = clampRenderScale(scale);

  return {
    height: '100%',
    minHeight: '100%',
    transform: `scale(${normalizedScale})`,
    transformOrigin: 'top center',
    width: '100%',
  };
}

function PdfCanvasPage({
  accentColor,
  onInteraction,
  onPageVisible,
  onRenderError,
  pageNumber,
  pdfDocument,
  renderScale,
}: {
  accentColor: string;
  onInteraction?: () => void;
  onPageVisible: (pageNumber: number) => void;
  onRenderError: (message: string) => void;
  pageNumber: number;
  pdfDocument: PdfDocumentProxy;
  renderScale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const pageElement = pageRef.current;

    if (!pageElement || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);

        if (visibleEntry) {
          onPageVisible(pageNumber);
        }
      },
      {
        root: pageElement.parentElement,
        threshold: [0.45, 0.7],
      }
    );

    observer.observe(pageElement);

    return () => {
      observer.disconnect();
    };
  }, [onPageVisible, pageNumber]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<PdfPageProxy['render']> | null = null;

    async function renderPage() {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      setIsRendering(true);

      try {
        const page = await pdfDocument.getPage(pageNumber);

        if (cancelled) {
          return;
        }

        const viewport = page.getViewport({ scale: renderScale });
        const outputScale =
          typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 1) : 1;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Canvas rendering is not available in this browser.');
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          viewport,
        });

        await renderTask.promise;

        if (!cancelled) {
          setIsRendering(false);
        }
      } catch (error) {
        if (cancelled || isCancelError(error)) {
          return;
        }

        console.error('[PdfDocumentViewer] page render failed', error);
        onRenderError('Preview not available. Open PDF in new tab.');
        setIsRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [onRenderError, pageNumber, pdfDocument, renderScale]);

  return (
    <div
      ref={pageRef}
      onMouseMove={onInteraction}
      onTouchStart={onInteraction}
      style={pageShellStyle}
    >
      {isRendering ? (
        <View pointerEvents="none" style={styles.pageLoading}>
          <ActivityIndicator color={accentColor} />
        </View>
      ) : null}
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
}

export function PdfDocumentViewer({
  accentColor,
  fileUrl,
  height,
  onError,
  onInteraction,
  onLoadComplete,
  onPageChanged,
  onSingleTap,
  scale = 1,
  width,
}: PdfDocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onErrorRef = useRef(onError);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onPageChangedRef = useRef(onPageChanged);
  const [containerWidth, setContainerWidth] = useState(width ?? 0);
  const [firstPageWidth, setFirstPageWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [useBrowserPreview, setUseBrowserPreview] = useState(false);

  useEffect(() => {
    onErrorRef.current = onError;
    onLoadCompleteRef.current = onLoadComplete;
    onPageChangedRef.current = onPageChanged;
  }, [onError, onLoadComplete, onPageChanged]);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const targetElement = element;

    function updateWidth() {
      setContainerWidth(targetElement.clientWidth || width || 0);
    }

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, [width]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PdfLoadingTask | null = null;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setLoadError(null);
        setPdfDocument(null);
        setUseBrowserPreview(false);
        onErrorRef.current?.('');

        const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
        pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();
        loadingTask = {
          promise: loadPdfDocument(pdfjs, fileUrl),
        };

        const documentProxy = await loadingTask.promise;

        if (cancelled) {
          await documentProxy.destroy?.();
          return;
        }

        const firstPage = await documentProxy.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });

        if (cancelled) {
          await documentProxy.destroy?.();
          return;
        }

        setFirstPageWidth(firstViewport.width);
        setPdfDocument(documentProxy);
        setIsLoading(false);
        onLoadCompleteRef.current?.(Math.max(documentProxy.numPages, 1));
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('[PdfDocumentViewer] load failed', error);
        setLoadError(null);
        setUseBrowserPreview(true);
        setIsLoading(false);
        onErrorRef.current?.('');
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      void loadingTask?.destroy?.();
    };
  }, [fileUrl]);

  useEffect(() => {
    return () => {
      void pdfDocument?.destroy?.();
    };
  }, [pdfDocument]);

  const fitScale = useMemo(() => {
    if (!containerWidth || !firstPageWidth) {
      return 1;
    }

    return clampRenderScale(Math.max((containerWidth - 28) / firstPageWidth, MIN_RENDER_SCALE));
  }, [containerWidth, firstPageWidth]);
  const renderScale = clampRenderScale(fitScale * scale);
  const pages = useMemo(
    () => Array.from({ length: pdfDocument?.numPages ?? 0 }, (_, index) => index + 1),
    [pdfDocument?.numPages]
  );

  function handleOpenPdf() {
    void Linking.openURL(fileUrl);
  }

  function handlePageVisible(pageNumber: number) {
    onPageChangedRef.current?.(pageNumber);
  }

  function handleInteraction() {
    onInteraction?.();
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
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={accentColor} />
          <Text style={styles.stateText}>Loading PDF...</Text>
        </View>
      ) : useBrowserPreview ? (
        <div
          ref={scrollRef}
          onClick={onSingleTap}
          onMouseMove={handleInteraction}
          onScroll={handleInteraction}
          onTouchStart={handleInteraction}
          style={scrollStyle}
        >
          <div style={getBrowserPreviewShellStyle(scale)}>
            <iframe
              src={fileUrl}
              style={browserPdfFrameStyle}
              title="PDF preview"
            />
          </div>
        </div>
      ) : loadError || !pdfDocument ? (
        <View style={styles.errorState}>
          <Text style={styles.stateTitle}>PDF unavailable</Text>
          <Text style={styles.stateText}>Preview not available. Open PDF in new tab.</Text>
          <Pressable
            onPress={handleOpenPdf}
            style={({ pressed }) => [
              styles.openButton,
              { borderColor: accentColor },
              pressed && styles.openButtonPressed,
            ]}
          >
            <Text style={[styles.openButtonText, { color: accentColor }]}>Open PDF in new tab</Text>
          </Pressable>
        </View>
      ) : (
        <div
          ref={scrollRef}
          onClick={onSingleTap}
          onMouseMove={handleInteraction}
          onScroll={handleInteraction}
          onTouchStart={handleInteraction}
          style={scrollStyle}
        >
          {pages.map((pageNumber) => (
            <PdfCanvasPage
              key={`${pageNumber}-${renderScale.toFixed(3)}`}
              accentColor={accentColor}
              onInteraction={handleInteraction}
              onPageVisible={handlePageVisible}
              onRenderError={(message) => {
                console.warn('[PdfDocumentViewer] canvas render unavailable; using browser PDF preview', message);
                setLoadError(null);
                setUseBrowserPreview(true);
                onError?.('');
              }}
              pageNumber={pageNumber}
              pdfDocument={pdfDocument}
              renderScale={renderScale}
            />
          ))}
        </div>
      )}
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

const pageShellStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'center',
  margin: '0 auto 18px',
  minHeight: 120,
  position: 'relative',
  width: 'max-content',
};

const canvasStyle: CSSProperties = {
  backgroundColor: '#120D0B',
  boxShadow: '0 18px 38px rgba(0, 0, 0, 0.34)',
  display: 'block',
  maxWidth: 'none',
};

const browserPdfFrameStyle: CSSProperties = {
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
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
  },
  pageLoading: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 2,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  stateText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  openButton: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  openButtonPressed: {
    opacity: 0.72,
  },
  openButtonText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
  },
});
