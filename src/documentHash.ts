export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export type PdfFingerprintErrorCode =
  | "not-a-file"
  | "empty-file"
  | "file-too-large"
  | "not-a-pdf"
  | "hash-failed";

export class PdfFingerprintError extends Error {
  readonly code: PdfFingerprintErrorCode;

  constructor(code: PdfFingerprintErrorCode, message: string) {
    super(message);
    this.name = "PdfFingerprintError";
    this.code = code;
  }
}

export type PdfFingerprint = {
  fileName: string;
  sizeBytes: number;
  sha256Bytes: Uint8Array;
  sha256Hex: string;
};

function hasPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function toLowercaseHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Reads and fingerprints a PDF entirely in the browser.
 * No PDF bytes are sent to a server or third-party service.
 */
export async function hashPdf(file: File): Promise<PdfFingerprint> {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new PdfFingerprintError("not-a-file", "Please select a PDF file.");
  }

  if (file.size === 0) {
    throw new PdfFingerprintError("empty-file", "The selected file is empty.");
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new PdfFingerprintError(
      "file-too-large",
      "PDF files must be 10 MB or smaller.",
    );
  }

  try {
    const fileBytes = await file.arrayBuffer();

    if (fileBytes.byteLength === 0) {
      throw new PdfFingerprintError("empty-file", "The selected file is empty.");
    }

    if (!hasPdfHeader(new Uint8Array(fileBytes))) {
      throw new PdfFingerprintError(
        "not-a-pdf",
        "The selected file does not have a valid PDF header.",
      );
    }

    const digest = await crypto.subtle.digest("SHA-256", fileBytes);
    const sha256Bytes = new Uint8Array(digest);

    return {
      fileName: file.name,
      sizeBytes: file.size,
      sha256Bytes,
      sha256Hex: toLowercaseHex(sha256Bytes),
    };
  } catch (error) {
    if (error instanceof PdfFingerprintError) {
      throw error;
    }

    throw new PdfFingerprintError(
      "hash-failed",
      "The PDF could not be read or hashed in this browser.",
    );
  }
}
