import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as pdfjsModule from 'pdfjs-dist/legacy/build/pdf.mjs';

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
  cleanup?: () => void;
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
const MAX_DEVICE_PIXEL_RATIO = 2;
const MAX_CANVAS_PIXELS = 5_000_000;

function isCancelError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'RenderingCancelledException' || error.name === 'AbortException')
  );
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

function getDocumentOptions() {
  return {
    cMapUrl: 'https://unpkg.com/pdfjs-dist@5.7.284/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.7.284/standard_fonts/',
    disableAutoFetch: true,
    disableRange: true,
    disableStream: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    withCredentials: false,
  };
}

async function getPdfDocument(pdfjs: PdfJsModule, options: Record<string, unknown>) {
  const loadingTask = pdfjs.getDocument(options);

  try {
    return await loadingTask.promise;
  } catch (error) {
    await loadingTask.destroy?.();
    throw error;
  }
}

async function fetchPdfBytes(fileUrl: string) {
  const response = await fetch(fileUrl, {
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors',
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch PDF bytes (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function loadPdfDocument(pdfjs: PdfJsModule, fileUrl: string) {
  const baseOptions = getDocumentOptions();

  try {
    console.log('[PdfDocumentViewer] loading PDF from URL', { fileUrl });
    return await getPdfDocument(pdfjs, {
      ...baseOptions,
      url: fileUrl,
    });
  } catch (urlError) {
    console.warn('[PdfDocumentViewer] URL load failed; retrying with fetched bytes', urlError);
  }

  const pdfBytes = await fetchPdfBytes(fileUrl);

  try {
    return await getPdfDocument(pdfjs, {
      ...baseOptions,
      data: pdfBytes.slice(),
    });
  } catch (workerError) {
    console.warn('[PdfDocumentViewer] worker load failed; retrying without worker', workerError);
  }

  return getPdfDocument(pdfjs, {
    ...baseOptions,
    data: pdfBytes.slice(),
    disableWorker: true,
  });
}

function getOutputScale(width: number, height: number) {
  const devicePixelRatio =
    typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 1) : 1;
  const cappedDevicePixelRatio = Math.min(devicePixelRatio, MAX_DEVICE_PIXEL_RATIO);
  const requestedPixels = width * height * cappedDevicePixelRatio * cappedDevicePixelRatio;

  if (requestedPixels <= MAX_CANVAS_PIXELS) {
    return cappedDevicePixelRatio;
  }

  return Math.max(Math.sqrt(MAX_CANVAS_PIXELS / Math.max(width * height, 1)), 0.5);
}

function PdfCanvasPage({
  accentColor,
  onInteraction,
  onPageVisible,
  onRenderError,
  pageNumber,
  pdfDocument,
  renderScale,
  scrollRoot,
}: {
  accentColor: string;
  onInteraction?: () => void;
  onPageVisible: (pageNumber: number) => void;
  onRenderError: (message: string) => void;
  pageNumber: number;
  pdfDocument: PdfDocumentProxy;
  renderScale: number;
  scrollRoot: HTMLDivElement | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const pageElement = pageRef.current;

    if (!pageElement || typeof IntersectionObserver === 'undefined') {
      if (pageNumber === 1) {
        onPageVisible(pageNumber);
      }
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
        root: scrollRoot,
        rootMargin: '35% 0px 35% 0px',
        threshold: [0.2, 0.5, 0.75],
      }
    );

    observer.observe(pageElement);

    return () => {
      observer.disconnect();
    };
  }, [onPageVisible, pageNumber, scrollRoot]);

  useEffect(() => {
    let cancelled = false;
    let pageProxy: PdfPageProxy | null = null;
    let renderTask: ReturnType<PdfPageProxy['render']> | null = null;

    async function renderPage() {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      setIsRendering(true);

      try {
        pageProxy = await pdfDocument.getPage(pageNumber);

        if (cancelled || !pageProxy) {
          return;
        }

        const viewport = pageProxy.getViewport({ scale: renderScale });
        const outputScale = getOutputScale(viewport.width, viewport.height);
        const context = canvas.getContext('2d', { alpha: false });

        if (!context) {
          throw new Error('Canvas rendering is not available in this browser.');
        }

        canvas.width = Math.max(Math.floor(viewport.width * outputScale), 1);
        canvas.height = Math.max(Math.floor(viewport.height * outputScale), 1);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.fillStyle = '#120D0B';
        context.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = pageProxy.render({
          canvas,
          canvasContext: context,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          viewport,
        });

        await renderTask.promise;
        pageProxy.cleanup?.();

        if (!cancelled) {
          setIsRendering(false);
        }
      } catch (error) {
        if (cancelled || isCancelError(error)) {
          return;
        }

        console.error('[PdfDocumentViewer] page render failed', error);
        const message = error instanceof Error ? error.stack || error.message : String(error);
        onRenderError(`DEBUG: ${message}`);
        setIsRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      pageProxy?.cleanup?.();
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
  const onErrorRef = useRef(onError);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onPageChangedRef = useRef(onPageChanged);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
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

  const setScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollRoot(node);
      setContainerWidth(node?.clientWidth || width || 0);
    },
    [width]
  );

  useEffect(() => {
    if (!scrollRoot) {
      return;
    }

    const root = scrollRoot;

    function updateWidth() {
      setContainerWidth(root.clientWidth || width || 0);
    }

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, [scrollRoot, width]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setLoadError(null);
        setPdfDocument(null);
        onErrorRef.current?.('');

        if (typeof Promise.withResolvers === 'undefined') {
          (Promise as any).withResolvers = function () {
            let resolve, reject;
            const promise = new Promise((res, rej) => {
              resolve = res;
              reject = rej;
            });
            return { promise, resolve, reject };
          };
        }

        if (typeof Object.hasOwn === 'undefined') {
          Object.hasOwn = function (obj, prop) {
            return Object.prototype.hasOwnProperty.call(obj, prop as string | symbol | number);
          };
        }

        const pdfjs = (
          pdfjsModule && 'default' in pdfjsModule ? (pdfjsModule as any).default : pdfjsModule
        ) as unknown as PdfJsModule;

        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();
        }
        const documentProxy = await loadPdfDocument(pdfjs, fileUrl);

        if (cancelled) {
          await documentProxy.destroy?.();
          return;
        }

        const firstPage = await documentProxy.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        firstPage.cleanup?.();

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
        const message = error instanceof Error ? error.stack || error.message : String(error);
        setLoadError(`DEBUG: ${message}`);
        setIsLoading(false);
        onErrorRef.current?.(`DEBUG: ${message}`);
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
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
          <Text style={styles.stateTitle}>PDF preview failed</Text>
          <Text style={styles.stateText}>
            The browser could not render this PDF. Please refresh and try again.
          </Text>
        </View>
      ) : (
        <div
          ref={setScrollNode}
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
              scrollRoot={scrollRoot}
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
