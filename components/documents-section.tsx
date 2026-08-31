"use client";

import { type ChangeEvent, useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { formatDateKey, type DocumentStatus } from "@/lib/documentStatus";
import { documentTypeLabel } from "@/lib/labels";
import type { Locale } from "@/lib/i18n";
import type { DocumentType } from "@/lib/generated/prisma/enums";

export type DocsLabels = {
  heading: string;
  none: string;
  colType: string;
  colNumber: string;
  colExpires: string;
  colStatus: string;
  colActions: string;
  renew: string;
  delete: string;
  deleteConfirm: string;
  newExpiryAria: string;
  addHeading: string;
  docType: string;
  numberSeries: string;
  issuedAt: string;
  expiresAt: string;
  add: string;
  saving: string;
  photo: string;
  photoAdd: string;
  photoChange: string;
  photoRemove: string;
  photoHint: string;
};

/** Resize a picked image to a document-sized JPEG data URL, in the browser. */
export function resizeImageToDataUrl(file: File, maxSide = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
import {
  createDocumentAction,
  deleteDocumentAction,
  renewDocumentAction,
  type DocumentFormState,
} from "@/app/dashboard/documente/actions";

export type DocumentRow = {
  id: string;
  type: DocumentType;
  number: string | null;
  issuedAt: string | null;
  expiresAt: string;
  status: DocumentStatus;
  imageData: string | null;
};

/**
 * Renewal in place, one row at a time. Its own component so each row keeps its
 * own action state — a shared one would show another row's error.
 */
function DocumentRenewal({
  documentId,
  ownerPath,
  currentExpiry,
  labels,
}: {
  documentId: string;
  ownerPath: string;
  currentExpiry: string;
  labels: DocsLabels;
}) {
  const boundAction = renewDocumentAction.bind(null, documentId, ownerPath);
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(boundAction, {
    error: null,
  });
  const [expiresAt, setExpiresAt] = useState(currentExpiry);

  return (
    <form action={formAction} className="flex items-center gap-1">
      <DatePicker
        name="expiresAt"
        value={expiresAt}
        onChange={(v) => setExpiresAt(v)}
        className="w-40"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : labels.renew}
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function DocumentsSection({
  ownerKind,
  ownerId,
  ownerPath,
  availableTypes,
  documents,
  locale,
  labels,
}: {
  ownerKind: "vehicle" | "driver";
  ownerId: string;
  ownerPath: string;
  availableTypes: readonly DocumentType[];
  documents: DocumentRow[];
  locale: Locale;
  labels: DocsLabels;
}) {
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(
    createDocumentAction,
    { error: null }
  );

  // Controlled, so a rejected submit does not wipe what was typed.
  const [type, setType] = useState<DocumentType>(availableTypes[0]);
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImageData(await resizeImageToDataUrl(file));
    } catch {
      /* ignore a bad image */
    }
  }

  // React 19's post-action form reset touches the <select> DOM node directly.
  // Text/date inputs self-heal via their internal value tracker, but a <select>
  // does not, so a rejected submit can leave the dropdown showing the wrong
  // option even though `type` state itself is still correct. Resync it
  // explicitly whenever the action settles.
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (typeSelectRef.current) typeSelectRef.current.value = type;
  }, [state, type]);

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-medium">{labels.heading}</h2>

      {documents.length === 0 ? (
        <p className="text-muted-foreground mb-6 rounded-lg border border-dashed p-6 text-center text-sm">
          {labels.none}
        </p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{labels.photo}</th>
                <th className="px-4 py-2 font-medium">{labels.colType}</th>
                <th className="px-4 py-2 font-medium">{labels.colNumber}</th>
                <th className="px-4 py-2 font-medium">{labels.colExpires}</th>
                <th className="px-4 py-2 font-medium">{labels.colStatus}</th>
                <th className="px-4 py-2 font-medium">{labels.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    {document.imageData ? (
                      <button type="button" onClick={() => setViewing(document.imageData)} aria-label={labels.photo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={document.imageData} alt="" className="h-10 w-14 rounded border object-cover" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{documentTypeLabel(document.type, locale)}</td>
                  <td className="text-muted-foreground px-4 py-2">{document.number ?? "—"}</td>
                  <td className="px-4 py-2">{formatDateKey(document.expiresAt)}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={document.status} locale={locale} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <DocumentRenewal
                        documentId={document.id}
                        ownerPath={ownerPath}
                        currentExpiry={document.expiresAt}
                        labels={labels}
                      />
                      <form action={deleteDocumentAction.bind(null, document.id, ownerPath)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                          onClick={(event) => {
                            if (!window.confirm(labels.deleteConfirm)) event.preventDefault();
                          }}
                        >
                          {labels.delete}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mb-3 text-sm font-medium">{labels.addHeading}</h3>
      <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <input
          type="hidden"
          name={ownerKind === "vehicle" ? "vehicleId" : "driverId"}
          value={ownerId}
        />

        <div className="space-y-1.5">
          <Label htmlFor="documentType">{labels.docType}</Label>
          <select
            ref={typeSelectRef}
            id="documentType"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className="w-full select-native"
          >
            {availableTypes.map((value) => (
              <option key={value} value={value}>
                {documentTypeLabel(value, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="number">{labels.numberSeries}</Label>
          <Input id="number" name="number" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issuedAt">{labels.issuedAt}</Label>
          <DatePicker
            id="issuedAt"
            name="issuedAt"
            value={issuedAt}
            onChange={(v) => setIssuedAt(v)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiresAt">{labels.expiresAt}</Label>
          <DatePicker
            id="expiresAt"
            name="expiresAt"
            value={expiresAt}
            onChange={(v) => setExpiresAt(v)}
          />
        </div>

        {/* Photo */}
        <input type="hidden" name="imageData" value={imageData ?? ""} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{labels.photo}</Label>
          <div className="flex items-center gap-4">
            {imageData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageData} alt="" className="h-20 w-28 rounded-md border object-cover" />
            ) : (
              <span className="bg-muted text-muted-foreground grid h-20 w-28 place-items-center rounded-md border">
                <ImagePlus className="size-6" />
              </span>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="mr-1.5 size-4" />
                  {imageData ? labels.photoChange : labels.photoAdd}
                </Button>
                {imageData && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setImageData(null)}>
                    <Trash2 className="mr-1.5 size-4" />
                    {labels.photoRemove}
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-xs">{labels.photoHint}</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          </div>
        </div>

        {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? labels.saving : labels.add}
          </Button>
        </div>
      </form>

      {viewing && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setViewing(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </section>
  );
}
