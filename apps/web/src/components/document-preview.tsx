"use client";
import { useEffect, useState } from "react";
import { Field } from "@signflow/shared";
import { PdfViewer } from "./pdf-viewer";
import { Loading, ErrorBox } from "./common";
export function DocumentPreview({
  fileId,
  fields,
  values = {},
}: {
  fileId: string;
  fields: Field[];
  values?: Record<string, string | boolean>;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState<Error | null>(null);
  const body = JSON.stringify({ fileId, fields, values });
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setUrl("");
    setError(null);
    const csrf =
      document.cookie
        .split("; ")
        .find((c) => c.startsWith("sf_csrf="))
        ?.split("=")[1] || "";
    fetch("/api/templates/preview", {
      method: "POST",
      body,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": decodeURIComponent(csrf),
      },
    })
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json();
          throw new Error(e.message);
        }
        return r.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [body]);
  return error ? (
    <ErrorBox error={error} />
  ) : url ? (
    <PdfViewer url={url} />
  ) : (
    <Loading />
  );
}
