import { useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { SOLANA_NETWORK_LABEL } from "./providers";

type WalletUiStatus = "disconnected" | "connecting" | "connected" | "error";

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The wallet could not be connected. Please try again.";
}

export function WalletPanel() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const address = wallet?.account.address.toString();
  const walletStatus: WalletUiStatus = connectionError
    ? "error"
    : status === "connected" || status === "connecting"
      ? status
      : "disconnected";

  const handleConnect = async (connectorId: string) => {
    setConnectionError(null);

    try {
      await connect(connectorId);
    } catch (error) {
      setConnectionError(getErrorMessage(error));
    }
  };

  const handleDisconnect = async () => {
    setConnectionError(null);

    try {
      await disconnect();
    } catch (error) {
      setConnectionError(getErrorMessage(error));
    }
  };

  const statusLabel = {
    disconnected: "Disconnected",
    connecting: "Connecting",
    connected: "Connected",
    error: "Connection error",
  }[walletStatus];

  return (
    <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold">Wallet</p>
          <p className="text-sm text-muted">
            Connect a Wallet Standard wallet to use VaultLine Lite on Devnet.
          </p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80">
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border-low bg-cream/30 px-4 py-3 text-sm">
        <span className="font-medium">Network</span>
        <span className="text-muted">{SOLANA_NETWORK_LABEL}</span>
      </div>

      {walletStatus === "connected" && address ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-low bg-cream/30 px-4 py-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted">
              Connected wallet
            </p>
            <p className="font-mono text-sm" title={address}>
              {shortenAddress(address)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            className="rounded-lg border border-border-low bg-card px-3 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {connectors.length === 0 ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              No compatible wallet was found. Install or enable a Wallet
              Standard wallet such as Phantom, then reload this page.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  type="button"
                  onClick={() => void handleConnect(connector.id)}
                  disabled={walletStatus === "connecting"}
                  className="group flex items-center justify-between rounded-xl border border-border-low bg-card px-4 py-3 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex flex-col">
                    <span className="text-base">
                      Connect Wallet · {connector.name}
                    </span>
                    <span className="text-xs text-muted">
                      {walletStatus === "connecting"
                        ? "Waiting for wallet…"
                        : "Wallet Standard"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full bg-border-low transition group-hover:bg-primary/80"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {walletStatus === "error" && connectionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {connectionError}
        </p>
      )}

      <p className="text-xs text-muted">
        The wallet signs locally in your wallet provider. VaultLine Lite never
        receives private keys or wallet secrets.
      </p>
    </section>
  );
}
