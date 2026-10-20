import { useRef, useState } from "react";
import {
  hashPdf,
  type PdfFingerprint,
  PdfFingerprintError,
} from "./documentHash";

export type PdfFilePickerProps = {
  disabled?: boolean;
  onFingerprint?: (fingerprint: PdfFingerprint | null) => void;
  onHashingChange?: (isHashing: boolean) => void;
};

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PdfFilePicker({
  disabled = false,
  onFingerprint,
  onHashingChange,
}: PdfFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fingerprint, setFingerprint] = useState<PdfFingerprint | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    setError(null);
    setFingerprint(null);
    onFingerprint?.(null);

    if (!file) return;

    setIsHashing(true);
    onHashingChange?.(true);
    try {
      const nextFingerprint = await hashPdf(file);
      setFingerprint(nextFingerprint);
      onFingerprint?.(nextFingerprint);
    } catch (hashError) {
      onFingerprint?.(null);
      setError(
        hashError instanceof PdfFingerprintError
          ? hashError.message
          : "The PDF could not be processed.",
      );
    } finally {
      setIsHashing(false);
      onHashingChange?.(false);
    }
  };

  const handleChooseAnother = () => {
    setFingerprint(null);
    setError(null);
    onFingerprint?.(null);
    onHashingChange?.(false);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  return (
    <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="space-y-1">
        <p className="text-lg font-semibold">Document fingerprint</p>
        <p className="text-sm text-muted">
          Select a PDF to calculate its SHA-256 fingerprint locally in your
          browser. The PDF bytes are never uploaded.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        disabled={disabled || isHashing}
        className="block w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-sm file:font-medium file:text-background"
      />

      {isHashing && (
        <p className="rounded-lg bg-cream/50 px-4 py-3 text-sm text-muted">
          Reading PDF and calculating SHA-256 locally…
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {fingerprint && !isHashing && (
        <div className="space-y-3 rounded-xl border border-border-low bg-cream/30 p-4">
          <div className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
            <span className="font-medium">Filename</span>
            <span className="truncate text-muted">{fingerprint.fileName}</span>
            <span className="font-medium">File size</span>
            <span className="text-muted">
              {formatFileSize(fingerprint.sizeBytes)} ({fingerprint.sizeBytes.toLocaleString()} bytes)
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">SHA-256</p>
            <code className="block break-all rounded-lg bg-card px-3 py-2 font-mono text-xs text-muted">
              {fingerprint.sha256Hex}
            </code>
          </div>
          <button
            type="button"
            onClick={handleChooseAnother}
            disabled={disabled || isHashing}
            className="rounded-lg border border-border-low bg-card px-3 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            Choose another PDF
          </button>
        </div>
      )}
    </section>
  );
}
