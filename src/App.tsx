import { useWalletConnection } from "@solana/react-hooks";
import { RegistrationPanel } from "./RegistrationPanel";
import { VerificationPanel } from "./VerificationPanel";
import { WalletPanel } from "./WalletPanel";
import { SOLANA_NETWORK_LABEL } from "./providers";

function SecurityItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-low bg-card/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

export default function App() {
  const { status } = useWalletConnection();
  const walletConnected = status === "connected";

  return (
    <div className="min-h-screen bg-bg1 text-foreground">
      <header className="border-b border-border-low">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">
                VaultLine Lite
              </p>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  Proof without the upload.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                  Fingerprint documents locally in your browser and prepare them
                  for privacy-first verification on Solana Devnet.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border-low bg-card px-4 py-3 text-sm shadow-sm">
              <p className="font-semibold">Privacy-first by design</p>
              <p className="mt-1 text-muted">
                Only a SHA-256 fingerprint leaves the browser.
              </p>
            </div>
          </div>
          <WalletPanel />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <RegistrationPanel walletConnected={walletConnected} />
          <VerificationPanel />
        </div>

        <section
          aria-labelledby="security-title"
          className="space-y-4 rounded-3xl border border-border-low bg-cream/30 p-5 sm:p-7"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Security status
            </p>
            <h2 id="security-title" className="mt-2 text-xl font-semibold">
              Local processing, transparent integration
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SecurityItem label="Network" value={SOLANA_NETWORK_LABEL} />
            <SecurityItem label="Processing" value="PDF processed locally" />
            <SecurityItem label="Fingerprint" value="SHA-256" />
            <SecurityItem
              label="Data handling"
              value="PDF bytes never uploaded"
            />
          </div>
        </section>

        <p className="text-center text-xs text-muted">
          Registration stores only a SHA-256 fingerprint on Solana Devnet.
          Verification will arrive in a future milestone.
        </p>
      </main>
    </div>
  );
}
