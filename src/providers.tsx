import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren } from "react";
import { autoDiscover, createClient } from "@solana/client";

export const SOLANA_NETWORK_LABEL = "Solana Devnet";
export const SOLANA_DEVNET_RPC_ENDPOINT = "https://api.devnet.solana.com";

const client = createClient({
  endpoint: SOLANA_DEVNET_RPC_ENDPOINT,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: PropsWithChildren) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
