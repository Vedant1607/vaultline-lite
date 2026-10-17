import { useState } from "react";
import { PdfFilePicker } from "./PdfFilePicker";
import type { PdfFingerprint } from "./documentHash";

type RegistrationPanelProps = {
  walletConnected: boolean;
};

export function RegistrationPanel({
  walletConnected,
}: RegistrationPanelProps) {
  const [fingerprint, setFingerprint] = useState<PdfFingerprint | null>(null);
  const blockchainIntegrationAvailable = false;
  const canPrepareRegistration = Boolean(fingerprint && walletConnected);

  return (
    <section
      aria-labelledby="registration-title"
      className="space-y-5 rounded-3xl border border-border-low bg-card p-5 shadow-[0_24px_90px_-55px_rgba(0,0,0,0.4)] sm:p-7"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Step 01
          </p>
          <h2 id="registration-title" className="text-2xl font-semibold">
            Register a document
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Create a local fingerprint for your PDF. The future registration
            transaction will use only the 32-byte fingerprint.
          </p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Blockchain integration pending
        </span>
      </div>

      <PdfFilePicker onFingerprint={setFingerprint} />

      <div className="space-y-3 border-t border-border-low pt-5">
        {!walletConnected && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Connect your wallet before registering a document.
          </p>
        )}
        {walletConnected && !fingerprint && (
          <p className="text-sm text-muted">
            Select a valid PDF and finish hashing to prepare registration.
          </p>
        )}
        {canPrepareRegistration && (
          <p className="text-sm text-muted">
            Fingerprint ready. The registration instruction will be enabled
            after the blockchain interface is confirmed.
          </p>
        )}
        <button
          type="button"
          disabled={!canPrepareRegistration || !blockchainIntegrationAvailable}
          className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Register Document
        </button>
        <p className="text-xs text-muted">
          No transaction is sent in this milestone. Success is never simulated.
        </p>
      </div>
    </section>
  );
}
