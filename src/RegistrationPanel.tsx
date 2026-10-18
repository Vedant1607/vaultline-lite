import { useCallback, useState } from "react";
import { useSendTransaction, useWalletConnection } from "@solana/react-hooks";
import { type Address } from "@solana/kit";
import { PdfFilePicker } from "./PdfFilePicker";
import type { PdfFingerprint } from "./documentHash";
import {
  findDocumentRecordPda,
  getRegisterDocumentInstructionDataEncoder,
  VAULT_PROGRAM_ADDRESS,
} from "./generated/vault";
import { SOLANA_DEVNET_RPC_ENDPOINT } from "./providers";

type RegistrationPanelProps = {
  walletConnected: boolean;
};

type RegistrationState =
  | { kind: "ready" }
  | { kind: "registering" }
  | { kind: "confirming"; signature: string }
  | { kind: "success"; signature: string }
  | { kind: "error"; message: string };

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

function getRegistrationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/already in use|already initialized|account.*exists/i.test(message)) {
    return "This document fingerprint is already registered.";
  }
  if (/reject|declin|denied|cancelled|canceled|user.*close/i.test(message)) {
    return "Wallet approval was rejected. No registration was created.";
  }
  if (
    /insufficient funds|insufficient.*lamport|insufficient.*balance|rent.*exempt/i.test(
      message
    )
  ) {
    return "Insufficient Devnet SOL to pay the account rent and transaction fee.";
  }
  if (/confirm|blockhash|block height|expired|dropped/i.test(message)) {
    return "The transaction was submitted but could not be confirmed. Check your wallet or Devnet explorer before retrying.";
  }
  if (/rpc|network|fetch|timeout|429|503|gateway/i.test(message)) {
    return "Devnet RPC request failed. Please try again in a moment.";
  }

  return message
    ? `Registration failed: ${message}`
    : "Registration failed. Please try again.";
}

async function confirmTransaction(signature: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(SOLANA_DEVNET_RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `vaultline-confirm-${attempt}`,
          method: "getSignatureStatuses",
          params: [[signature], { searchTransactionHistory: true }],
        }),
      });
    } catch {
      throw new Error("RPC confirmation request failed.");
    }

    if (!response.ok) {
      throw new Error("RPC confirmation request failed.");
    }

    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      ("error" in payload && payload.error)
    ) {
      throw new Error("RPC confirmation request failed.");
    }

    const status = (
      payload as {
        result?: {
          value?: Array<{
            err?: unknown;
            confirmationStatus?: string;
          } | null>;
        };
      }
    ).result?.value?.[0];

    if (status?.err) {
      throw new Error("Transaction confirmation failed.");
    }
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1_000));
  }

  throw new Error("Transaction confirmation timed out.");
}

export function RegistrationPanel({ walletConnected }: RegistrationPanelProps) {
  const [fingerprint, setFingerprint] = useState<PdfFingerprint | null>(null);
  const [registrationState, setRegistrationState] = useState<RegistrationState>(
    { kind: "ready" }
  );
  const { wallet } = useWalletConnection();
  const { send, isSending } = useSendTransaction();
  const canPrepareRegistration = Boolean(fingerprint && walletConnected);
  const isRegistering = isSending || registrationState.kind === "confirming";

  const handleFingerprint = useCallback(
    (nextFingerprint: PdfFingerprint | null) => {
      setFingerprint(nextFingerprint);
      setRegistrationState({ kind: "ready" });
    },
    []
  );

  const handleRegister = useCallback(async () => {
    const registrant = wallet?.account.address;
    if (!fingerprint || !registrant) {
      setRegistrationState({
        kind: "error",
        message: "Connect a wallet and select a hashed PDF before registering.",
      });
      return;
    }

    if (fingerprint.sha256Bytes.length !== 32) {
      setRegistrationState({
        kind: "error",
        message: "The local SHA-256 fingerprint is not 32 bytes long.",
      });
      return;
    }

    try {
      setRegistrationState({ kind: "registering" });
      const documentHash = fingerprint.sha256Bytes;
      const [documentRecord] = await findDocumentRecordPda({ documentHash });
      const signature = await send({
        instructions: [
          {
            programAddress: VAULT_PROGRAM_ADDRESS,
            accounts: [
              { address: registrant, role: 3 },
              { address: documentRecord, role: 1 },
              { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
            ],
            data: getRegisterDocumentInstructionDataEncoder().encode({
              documentHash,
            }),
          },
        ],
      });

      setRegistrationState({ kind: "confirming", signature });
      await confirmTransaction(signature);
      setRegistrationState({ kind: "success", signature });
    } catch (error) {
      setRegistrationState({
        kind: "error",
        message: getRegistrationErrorMessage(error),
      });
    }
  }, [fingerprint, send, wallet?.account.address]);

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
            Create a local fingerprint for your PDF. Registration sends only the
            32-byte fingerprint to Solana Devnet.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          Devnet registration
        </span>
      </div>

      <PdfFilePicker
        disabled={isRegistering}
        onFingerprint={handleFingerprint}
      />

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
            Ready. Your wallet will pay the Devnet account rent and transaction
            fee; the PDF itself never leaves this browser.
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleRegister()}
          disabled={!canPrepareRegistration || isRegistering}
          className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {registrationState.kind === "registering"
            ? "Registering…"
            : registrationState.kind === "confirming"
              ? "Transaction submitted / confirming…"
              : "Register Document"}
        </button>
        {registrationState.kind === "registering" && (
          <p className="text-sm text-muted">
            Registering — approve the transaction in your wallet.
          </p>
        )}
        {registrationState.kind === "confirming" && (
          <p className="text-sm text-muted">
            Transaction submitted. Waiting for Devnet confirmation…
          </p>
        )}
        {registrationState.kind === "success" && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            <p className="font-medium">Registered successfully.</p>
            <a
              href={`https://explorer.solana.com/tx/${registrationState.signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="break-all underline underline-offset-2"
            >
              View transaction: {registrationState.signature}
            </a>
          </div>
        )}
        {registrationState.kind === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            {registrationState.message}
          </p>
        )}
      </div>
    </section>
  );
}
