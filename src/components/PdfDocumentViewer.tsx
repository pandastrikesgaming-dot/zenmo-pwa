import { useEffect, useMemo, useRef, useState } from 'react';
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

    const pdfBytes = new Uint8Array(await response.arrayBuffer());
    const byteTask = pdfjs.getDocument({
      data: pdfBytes.slice(),
      disableAutoFetch: true,
      disableRange: true,
      disableStream: true,
    });

    try {
      return await byteTask.promise;
    } catch (byteError) {
      await byteTask.destroy?.();
      console.warn('[PdfDocumentViewer] worker load failed; retrying without worker', byteError);
      const noWorkerTask = pdfjs.getDocument({
        data: pdfBytes.slice(),
        disableAutoFetch: true,
        disableRange: true,
        disableStream: true,
        disableWorker: true,
      });

      return noWorkerTask.promise;
    }
  }
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
        onRenderError('PDF preview failed. Please refresh and try again.');
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
        const message = 'PDF preview failed. Please refresh and try again.';
        setLoadError(message);
        setIsLoading(false);
        onErrorRef.current?.(message);
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
      ) : loadError || !pdfDocument ? (
        <View style={styles.errorState}>
          <Text style={styles.stateTitle}>PDF unavailable</Text>
          <Text style={styles.stateText}>{loadError ?? 'PDF preview failed. Please refresh and try again.'}</Text>
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
                setLoadError(message);
                onError?.(message);
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
});
