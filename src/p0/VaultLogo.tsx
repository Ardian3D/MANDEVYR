import type { VaultDefinition } from "./registry";

/** Original curator and underlying-asset artwork served by Morpho's own CDN. */
export function VaultLogo({ vault }: { vault: Pick<VaultDefinition, "curator" | "asset"> }) {
  const curatorLogo = vault.curator === "Galaxy Curation" ? "galaxy.png" : vault.curator === "Gauntlet" ? "gauntlet.svg" : null;
  return <div className="p0-vault-logo">
    {curatorLogo ? <img className="p0-curator-logo" src={`/brand/vaults/${curatorLogo}`} alt={`${vault.curator} logo`} width={46} height={46} /> : <span className="p0-vault-logo-fallback" aria-label={vault.curator}>{vault.curator.slice(0, 1)}</span>}
    <img className="p0-token-badge" src={`/brand/vaults/${vault.asset.toLowerCase()}.svg`} alt={vault.asset} width={19} height={19} />
  </div>;
}
