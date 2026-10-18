import { useCallback, useState } from "react";
import {
  useSendTransaction,
  useSolanaClient,
  useWalletConnection,
} from "@solana/react-hooks";
import { type Address, type ReadonlyUint8Array } from "@solana/kit";
import {
  DOCUMENT_RECORD_DISCRIMINATOR,
  fetchMaybeDocumentRecord,
  findDocumentRecordPda,
  getRegisterDocumentInstructionDataEncoder,
  VAULT_PROGRAM_ADDRESS,
} from "./generated/vault";

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

type VerificationResult =
  | { status: "idle" }
  | { status: "missing"; hash: Uint8Array; documentRecord: Address }
  | {
      status: "registered";
      hash: Uint8Array;
      documentRecord: Address;
      registrant: Address;
      registeredAt: bigint;
    }
  | { status: "error"; message: string };

function bytesMatch(left: ReadonlyUint8Array, right: ReadonlyUint8Array) {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

async function hashPdf(file: File): Promise<Uint8Array> {
  const isPdf =
    file.type === "application/pdf" ||
    (!file.type && file.name.toLowerCase().endsWith(".pdf"));

  if (!isPdf) {
    throw new Error("Select a PDF file.");
  }

  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return new Uint8Array(digest);
}

function formatTimestamp(timestamp: bigint) {
  const seconds = Number(timestamp);
  return Number.isSafeInteger(seconds)
    ? new Date(seconds * 1_000).toLocaleString()
    : timestamp.toString();
}

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();
  const client = useSolanaClient();

  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult>({
    status: "idle",
  });

  const walletAddress = wallet?.account.address;

  const handleRegister = useCallback(async () => {
    if (!walletAddress || !registrationFile) {
      return;
    }

    try {
      setRegistrationStatus("Hashing PDF locally...");
      const documentHash = await hashPdf(registrationFile);
      const [documentRecord] = await findDocumentRecordPda({ documentHash });

      setRegistrationStatus("Awaiting wallet signature...");
      const signature = await send({
        instructions: [
          {
            programAddress: VAULT_PROGRAM_ADDRESS,
            accounts: [
              { address: walletAddress, role: 3 },
              { address: documentRecord, role: 1 },
              { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
            ],
            data: getRegisterDocumentInstructionDataEncoder().encode({
              documentHash,
            }),
          },
        ],
      });

      setRegistrationStatus(
        `Document registered. Signature: ${signature.slice(0, 20)}...`,
      );
      setRegistrationFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setRegistrationStatus(
        /already in use|already initialized/i.test(message)
          ? "This document hash is already registered."
          : `Registration failed: ${message}`,
      );
    }
  }, [registrationFile, send, walletAddress]);

  const handleVerify = useCallback(async () => {
    if (!verificationFile) {
      return;
    }

    try {
      setVerificationResult({ status: "idle" });
      const documentHash = await hashPdf(verificationFile);
      const [documentRecord] = await findDocumentRecordPda({ documentHash });
      const account = await fetchMaybeDocumentRecord(
        client.runtime.rpc,
        documentRecord,
      );

      if (!account.exists) {
        setVerificationResult({ status: "missing", hash: documentHash, documentRecord });
        return;
      }

      if (
        account.programAddress !== VAULT_PROGRAM_ADDRESS ||
        !bytesMatch(account.data.discriminator, DOCUMENT_RECORD_DISCRIMINATOR) ||
        !bytesMatch(account.data.documentHash, documentHash)
      ) {
        throw new Error("The derived address does not contain a valid document record.");
      }

      setVerificationResult({
        status: "registered",
        hash: documentHash,
        documentRecord,
        registrant: account.data.registrant,
        registeredAt: account.data.registeredAt,
      });
    } catch (error) {
      setVerificationResult({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to verify document.",
      });
    }
  }, [client.runtime.rpc, verificationFile]);

  return (
    <section className="w-full max-w-3xl space-y-6 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="space-y-1">
        <p className="text-lg font-semibold">Document registry</p>
        <p className="text-sm text-muted">
          PDFs are hashed with SHA-256 in this browser. Only the 32-byte fingerprint,
          registrant wallet, and timestamp are recorded on Solana.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border-low bg-cream/30 p-4">
        <div>
          <p className="font-medium">Register a document</p>
          <p className="text-sm text-muted">
            {status === "connected"
              ? "Your wallet pays to create a permanent record for this fingerprint."
              : "Connect a wallet to register a document."}
          </p>
        </div>
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => setRegistrationFile(event.target.files?.[0] ?? null)}
          disabled={isSending || status !== "connected"}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
        />
        <button
          onClick={handleRegister}
          disabled={isSending || status !== "connected" || !registrationFile}
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? "Confirming..." : "Register fingerprint"}
        </button>
        {registrationStatus && (
          <p className="rounded-lg bg-card px-3 py-2 text-sm">{registrationStatus}</p>
        )}
      </div>

      <div className="space-y-3 border-t border-border-low pt-6">
        <div>
          <p className="font-medium">Verify a document</p>
          <p className="text-sm text-muted">
            Verification does not need a connected wallet and never uploads the PDF.
          </p>
        </div>
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => setVerificationFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-cream file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
        />
        <button
          onClick={handleVerify}
          disabled={!verificationFile}
          className="rounded-lg border border-border-low bg-card px-5 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Verify fingerprint
        </button>

        {verificationResult.status === "missing" && (
          <div className="rounded-lg bg-cream/50 px-4 py-3 text-sm">
            No registration was found for this document fingerprint.
          </div>
        )}
        {verificationResult.status === "registered" && (
          <div className="space-y-1 rounded-lg bg-cream/50 px-4 py-3 text-sm">
            <p className="font-medium">Registered document found</p>
            <p className="break-all font-mono text-xs text-muted">
              Registrant: {verificationResult.registrant}
            </p>
            <p className="text-muted">
              Registered: {formatTimestamp(verificationResult.registeredAt)}
            </p>
          </div>
        )}
        {verificationResult.status === "error" && (
          <div className="rounded-lg bg-cream/50 px-4 py-3 text-sm">
            Verification failed: {verificationResult.message}
          </div>
        )}
      </div>
    </section>
  );
}
