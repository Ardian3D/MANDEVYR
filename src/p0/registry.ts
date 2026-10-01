export type OpportunityStatus = "fresh" | "stale" | "error";

export type VaultDefinition = {
  id: string;
  name: string;
  provider: string;
  curator: string;
  asset: "USDC" | "EURC";
  assetAddress: `0x${string}`;
  address: `0x${string}`;
  sourceUrl: string;
  description: string;
  riskFlags: string[];
  reviewedAt: string;
};

export type VaultSnapshot = VaultDefinition & {
  chainId: 5042;
  type: "vault";
  status: OpportunityStatus;
  codePresent: boolean;
  assetMatched: boolean;
  shareSymbol: string | null;
  shareDecimals: number | null;
  assetDecimals: number | null;
  totalAssetsRaw: string | null;
  blockNumber: string | null;
  blockTimestamp: string | null;
  fetchedAt: string;
  error: string | null;
};

export type RegistryResponse = {
  network: "Arc Mainnet";
  chainId: 5042;
  observedAt: string;
  items: VaultSnapshot[];
};

export type PositionSnapshot = {
  vaultId: string;
  sharesRaw: string;
  assetsRaw: string | null;
  maxWithdrawRaw: string | null;
  status: "available" | "unavailable";
};

export type WalletSnapshot = {
  address: `0x${string}`;
  chainId: 5042;
  blockNumber: string;
  observedAt: string;
  nativeUsdcRaw: string;
  nativeUsdcDecimals: 18;
  positions: PositionSnapshot[];
};

export const ARC_RPC = "https://rpc.mainnet.arc.io";
export const ARC_EXPLORER = "https://explorer.arc.io";
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

// Curated from the provider's Arc vault pages, then checked against Arc Mainnet.
// Names and descriptions are editorial metadata. Live amounts come from RPC.
export const VAULTS: VaultDefinition[] = [
  {
    id: "galaxy-usdc",
    name: "Galaxy USDC",
    provider: "Morpho",
    curator: "Galaxy Curation",
    asset: "USDC",
    assetAddress: USDC_ADDRESS,
    address: "0x8E357432CC12ff425c36432F312968aEb16112AF",
    sourceUrl: "https://app.morpho.org/arc/vault/0x8E357432CC12ff425c36432F312968aEb16112AF/galaxy-usdc",
    description: "USDC vault curated by Galaxy. Review its allocation, liquidity, and current terms at the provider before taking action.",
    riskFlags: ["Smart contract", "Liquidity", "Variable yield"],
    reviewedAt: "2026-09-30",
  },
  {
    id: "gauntlet-usdc-prime",
    name: "Gauntlet USDC Prime",
    provider: "Morpho",
    curator: "Gauntlet",
    asset: "USDC",
    assetAddress: USDC_ADDRESS,
    address: "0xdECcd53BE5453215821184824B519E04C7e00bC7",
    sourceUrl: "https://app.morpho.org/arc/vault/0xdECcd53BE5453215821184824B519E04C7e00bC7/gauntlet-usdc-prime",
    description: "Gauntlet curated USDC vault. Borrower demand, collateral markets, and withdrawal liquidity can change.",
    riskFlags: ["Collateral", "Liquidity", "Variable yield"],
    reviewedAt: "2026-09-30",
  },
  {
    id: "gauntlet-eurc-prime",
    name: "Gauntlet EURC Prime",
    provider: "Morpho",
    curator: "Gauntlet",
    asset: "EURC",
    assetAddress: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
    address: "0x05863F54B05e96092069eF30c9Ca6060336e50B9",
    sourceUrl: "https://app.morpho.org/arc/vault/0x05863F54B05e96092069eF30c9Ca6060336e50B9/gauntlet-eurc-prime",
    description: "Gauntlet curated EURC vault. Currency exposure and redemption terms require their own review.",
    riskFlags: ["Currency exposure", "Liquidity", "Variable yield"],
    reviewedAt: "2026-09-30",
  },
];
