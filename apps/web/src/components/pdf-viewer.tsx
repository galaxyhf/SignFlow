"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Field } from "@signflow/shared";
import { Loading, ErrorBox } from "./common";
export function PdfViewer({
  url,
  fields = [],
  selected,
  onSelect,
  onChange,
  editable = false,
  zoom = 1,
  page,
  onPages,
}: {
  url: string;
  fields?: Field[];
  selected?: string;
  onSelect?: (id: string) => void;
  onChange?: (fields: Field[]) => void;
  editable?: boolean;
  zoom?: number;
  page?: number;
  onPages?: (n: number) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState<Error | null>(null);
  const host = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(600);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const o = new ResizeObserver((entries) =>
      setWidth(Math.max(240, entries[0].contentRect.width - 28)),
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    setPdf(null);
    setError(null);
    import("pdfjs-dist")
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = lib.getDocument({ url, withCredentials: true });
        return task.promise;
      })
      .then((doc) => {
        if (cancelled) {
          task?.destroy();
          return;
        }
        setPdf(doc);
        onPages?.(doc.numPages);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            new Error(e instanceof Error ? e.message : "Falha ao abrir PDF"),
          );
      });
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [url, onPages]);
  return (
    <div ref={host} style={{ minWidth: 0 }}>
      <ErrorBox error={error} />
      {!pdf && !error ? (
        <Loading />
      ) : (
        pdf && (
          <div className="pdf-view">
            {Array.from({ length: pdf.numPages }, (_, i) => i)
              .filter((i) => page === undefined || i === page)
              .map((i) => (
                <PdfPage
                  key={i}
                  pdf={pdf}
                  index={i}
                  width={width * zoom}
                  fields={fields}
                  selected={selected}
                  onSelect={onSelect}
                  onChange={onChange}
                  editable={editable}
                />
              ))}
          </div>
        )
      )}
    </div>
  );
}
function PdfPage({
  pdf,
  index,
  width,
  fields,
  selected,
  onSelect,
  onChange,
  editable,
}: {
  pdf: PDFDocumentProxy;
  index: number;
  width: number;
  fields: Field[];
  selected?: string;
  onSelect?: (id: string) => void;
  onChange?: (f: Field[]) => void;
  editable: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null),
    [height, setHeight] = useState(width * 1.414);
  useEffect(() => {
    let cancelled = false;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    pdf
      .getPage(index + 1)
      .then((p) => {
        if (cancelled || !canvas.current) return;
        const base = p.getViewport({ scale: 1 }),
          view = p.getViewport({ scale: width / base.width }),
          ratio = Math.min(window.devicePixelRatio || 1, 2);
        setHeight(view.height);
        const c = canvas.current;
        c.width = view.width * ratio;
        c.height = view.height * ratio;
        const context = c.getContext("2d")!;
        render = p.render({
          canvas: c,
          canvasContext: context,
          viewport: view,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        return render.promise;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf, index, width]);
  function start(e: React.PointerEvent, f: Field, resize = false) {
    if (!editable || !onChange) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(f.id);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const initial = { x: e.clientX, y: e.clientY };
    const rect = container.current!.getBoundingClientRect();
    const move = (event: PointerEvent) => {
      const dx = (event.clientX - initial.x) / rect.width,
        dy = (event.clientY - initial.y) / rect.height;
      const next = resize
        ? {
            ...f,
            width: Math.max(0.02, Math.min(1 - f.x, f.width + dx)),
            height: Math.max(0.015, Math.min(1 - f.y, f.height + dy)),
          }
        : {
            ...f,
            x: Math.max(0, Math.min(1 - f.width, f.x + dx)),
            y: Math.max(0, Math.min(1 - f.height, f.y + dy)),
          };
      onChange(fields.map((x) => (x.id === f.id ? next : x)));
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }
  return (
    <div
      className="pdf-page"
      ref={container}
      style={{ width, height }}
      aria-label={`Página ${index + 1}`}
    >
      <canvas ref={canvas} />
      {fields
        .filter((f) => f.page === index)
        .map((f) => (
          <div
            role="button"
            tabIndex={editable ? 0 : -1}
            aria-label={f.label}
            className={`pdf-field ${selected === f.id ? "selected" : ""}`}
            key={f.id}
            style={{
              left: `${f.x * 100}%`,
              top: `${f.y * 100}%`,
              width: `${f.width * 100}%`,
              height: `${f.height * 100}%`,
            }}
            onClick={() => onSelect?.(f.id)}
            onPointerDown={(e) => start(e, f)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect?.(f.id);
              if (
                editable &&
                ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                const n = {
                  ...f,
                  x: Math.max(
                    0,
                    Math.min(
                      1 - f.width,
                      f.x +
                        (e.key === "ArrowRight"
                          ? 0.005
                          : e.key === "ArrowLeft"
                            ? -0.005
                            : 0),
                    ),
                  ),
                  y: Math.max(
                    0,
                    Math.min(
                      1 - f.height,
                      f.y +
                        (e.key === "ArrowDown"
                          ? 0.005
                          : e.key === "ArrowUp"
                            ? -0.005
                            : 0),
                    ),
                  ),
                };
                onChange?.(fields.map((x) => (x.id === f.id ? n : x)));
              }
            }}
          >
            {f.label}
            {f.required ? " *" : ""}
            {editable && (
              <div
                className="resize"
                aria-label="Redimensionar"
                onPointerDown={(e) => start(e, f, true)}
              />
            )}
          </div>
        ))}
    </div>
  );
}
