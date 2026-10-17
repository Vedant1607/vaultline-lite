import { useState } from "react";
import { PdfFilePicker } from "./PdfFilePicker";
import type { PdfFingerprint } from "./documentHash";

export function VerificationPanel() {
  const [fingerprint, setFingerprint] = useState<PdfFingerprint | null>(null);
  const blockchainIntegrationAvailable = false;

  return (
    <section
      aria-labelledby="verification-title"
      className="space-y-5 rounded-3xl border border-border-low bg-card p-5 shadow-[0_24px_90px_-55px_rgba(0,0,0,0.4)] sm:p-7"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Step 02
          </p>
          <h2 id="verification-title" className="text-2xl font-semibold">
            Verify a document
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Hash a PDF locally, then compare its fingerprint with the confirmed
            on-chain record when blockchain integration is available.
          </p>
        </div>
        <span className="rounded-full border border-border-low bg-cream px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          Awaiting account lookup
        </span>
      </div>

      <PdfFilePicker onFingerprint={setFingerprint} />

      <div className="space-y-3 border-t border-border-low pt-5">
        {!fingerprint && (
          <p className="text-sm text-muted">
            Select a valid PDF to compute a fingerprint before verification.
          </p>
        )}
        {fingerprint && (
          <p className="text-sm text-muted">
            Fingerprint ready. On-chain PDA derivation and account lookup are
            not enabled yet.
          </p>
        )}
        <button
          type="button"
          disabled={!fingerprint || !blockchainIntegrationAvailable}
          className="w-full rounded-xl border border-border-low bg-card px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Verify Document
        </button>
        <div
          role="status"
          className="rounded-xl border border-border-low bg-cream/40 px-4 py-4 text-sm text-muted"
        >
          <p className="font-medium text-foreground">Verification result</p>
          <p className="mt-1">
            No MATCH or NO MATCH result is available until the blockchain
            account interface is confirmed.
          </p>
        </div>
      </div>
    </section>
  );
}
