import { useCallback, useRef, useState } from "react";
import { useSolanaClient } from "@solana/react-hooks";
import { type ReadonlyUint8Array } from "@solana/kit";
import { PdfFilePicker } from "./PdfFilePicker";
import type { PdfFingerprint } from "./documentHash";
import {
  DOCUMENT_RECORD_DISCRIMINATOR,
  fetchMaybeDocumentRecord,
  findDocumentRecordPda,
  VAULT_PROGRAM_ADDRESS,
} from "./generated/vault";

type VerificationState =
  | { kind: "ready" }
  | { kind: "hashing" }
  | { kind: "looking-up" }
  | { kind: "match"; registrant: string; registeredAt: string }
  | { kind: "no-match" }
  | { kind: "error"; message: string };

function bytesMatch(
  left: ReadonlyUint8Array,
  right: ReadonlyUint8Array
): boolean {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

function formatRegistrationTimestamp(timestamp: bigint): string {
  const seconds = Number(timestamp);
  const milliseconds = seconds * 1_000;

  if (!Number.isSafeInteger(seconds) || !Number.isFinite(milliseconds)) {
    return `Unix timestamp: ${timestamp.toString()}`;
  }

  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime())
    ? `Unix timestamp: ${timestamp.toString()}`
    : date.toLocaleString();
}

function getVerificationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/rpc|network|fetch|timeout|429|503|gateway/i.test(message)) {
    return "Devnet RPC lookup failed. Please try again in a moment.";
  }
  if (/decode|discriminator|invalid document record/i.test(message)) {
    return "The on-chain account is not a valid VaultLine Lite document record.";
  }

  return message
    ? `Verification failed: ${message}`
    : "Verification failed unexpectedly. Please try again.";
}

export function VerificationPanel() {
  const [fingerprint, setFingerprint] = useState<PdfFingerprint | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>(
    { kind: "ready" }
  );
  const fingerprintRef = useRef<PdfFingerprint | null>(null);
  const client = useSolanaClient();

  const handleFingerprint = useCallback(
    (nextFingerprint: PdfFingerprint | null) => {
      fingerprintRef.current = nextFingerprint;
      setFingerprint(nextFingerprint);
      setVerificationState({ kind: "ready" });
    },
    []
  );

  const handleHashingChange = useCallback((isHashing: boolean) => {
    if (isHashing) {
      setVerificationState({ kind: "hashing" });
    } else if (!fingerprintRef.current) {
      setVerificationState({ kind: "ready" });
    }
  }, []);

  const handleVerify = useCallback(async () => {
    if (!fingerprint) {
      setVerificationState({
        kind: "error",
        message: "Select a valid PDF before verifying its fingerprint.",
      });
      return;
    }

    const documentHash = fingerprint.sha256Bytes;
    if (documentHash.length !== 32) {
      setVerificationState({
        kind: "error",
        message: "The local SHA-256 fingerprint is not 32 bytes long.",
      });
      return;
    }

    try {
      setVerificationState({ kind: "looking-up" });
      const [documentRecord] = await findDocumentRecordPda({ documentHash });
      const account = await fetchMaybeDocumentRecord(
        client.runtime.rpc,
        documentRecord
      );

      if (!account.exists) {
        setVerificationState({ kind: "no-match" });
        return;
      }

      if (
        account.programAddress !== VAULT_PROGRAM_ADDRESS ||
        !bytesMatch(account.data.discriminator, DOCUMENT_RECORD_DISCRIMINATOR)
      ) {
        throw new Error("Invalid document record account.");
      }

      if (!bytesMatch(account.data.documentHash, documentHash)) {
        setVerificationState({ kind: "no-match" });
        return;
      }

      setVerificationState({
        kind: "match",
        registrant: account.data.registrant,
        registeredAt: formatRegistrationTimestamp(account.data.registeredAt),
      });
    } catch (error) {
      setVerificationState({
        kind: "error",
        message: getVerificationErrorMessage(error),
      });
    }
  }, [client.runtime.rpc, fingerprint]);

  const isLookingUp = verificationState.kind === "looking-up";

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
            Hash a PDF locally, then look up its fingerprint on Solana Devnet.
            The PDF bytes never leave your browser.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          Devnet lookup
        </span>
      </div>

      <PdfFilePicker
        disabled={isLookingUp}
        onFingerprint={handleFingerprint}
        onHashingChange={handleHashingChange}
      />

      <div className="space-y-3 border-t border-border-low pt-5">
        {!fingerprint && (
          <p className="text-sm text-muted">
            Select a valid PDF to compute a fingerprint before verification.
          </p>
        )}
        {verificationState.kind === "hashing" && (
          <p className="text-sm text-muted">
            Hashing the PDF locally. No PDF bytes are uploaded.
          </p>
        )}
        {fingerprint && verificationState.kind === "ready" && (
          <p className="text-sm text-muted">
            Ready. Look up this 32-byte fingerprint without connecting a wallet.
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={
            !fingerprint || isLookingUp || verificationState.kind === "hashing"
          }
          className="w-full rounded-xl border border-border-low bg-card px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {isLookingUp ? "Looking up registration…" : "Verify Document"}
        </button>
        {verificationState.kind === "looking-up" && (
          <div
            role="status"
            className="rounded-xl border border-border-low bg-cream/40 px-4 py-4 text-sm text-muted"
          >
            <p className="font-medium text-foreground">
              Looking up registration
            </p>
            <p className="mt-1">
              Deriving the document record and querying Devnet…
            </p>
          </div>
        )}
        {verificationState.kind === "match" && (
          <div
            role="status"
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-4 text-sm text-primary"
          >
            <p className="font-semibold">MATCH</p>
            <p className="mt-1 text-foreground">
              This PDF fingerprint is registered on Solana Devnet.
            </p>
            <dl className="mt-3 grid gap-2 text-foreground sm:grid-cols-[auto_1fr]">
              <dt className="font-medium">Registrant</dt>
              <dd className="break-all font-mono text-xs">
                {verificationState.registrant}
              </dd>
              <dt className="font-medium">Registered</dt>
              <dd>{verificationState.registeredAt}</dd>
            </dl>
          </div>
        )}
        {verificationState.kind === "no-match" && (
          <div
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-800 dark:text-amber-200"
          >
            <p className="font-semibold">NO MATCH</p>
            <p className="mt-1">
              No registration was found for this PDF fingerprint on Solana
              Devnet.
            </p>
          </div>
        )}
        {verificationState.kind === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            {verificationState.message}
          </p>
        )}
      </div>
    </section>
  );
}
