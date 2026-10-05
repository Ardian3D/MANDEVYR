# Galaxy USDC funded round trip — 2026-10-05 UTC

Wallet `0x2D44a6E9afAEA4d686E886f93b0BfD2059F20F01` confirmed each transaction on Arc Mainnet (chain ID 5042) through the public MANDEVYR Actions flow. The production D1 action records show `confirmed`; direct Arc RPC receipts returned status `0x1` for each hash.

| Step | Amount or effect | Arc transaction |
|---|---|---|
| Approve native USDC to Morpho VaultBundlesV1 | Exact 0.05 USDC allowance | [0x1e399b…](https://explorer.arc.io/tx/0x1e399bf10c883ac05c2a32d5345d9fba1d167e64666067afee1f4be286cb0679) |
| Deposit to Galaxy USDC | 0.05 USDC transferred; 0.050016403852989080 vault shares minted to the wallet | [0x224067…](https://explorer.arc.io/tx/0x2240672c72b9c9e6a41b2d548d57ae478796db517bb8ff5ac43f20489cd60e8c) |
| Approve Galaxy vault shares to Morpho VaultBundlesV1 | Exact protected share allowance for 0.04 USDC withdrawal | [0xb0a96c…](https://explorer.arc.io/tx/0xb0a96ce0394bf9b92051aff3e6bb32930bf511bad8c4d93bb2bad3afd70c6138) |
| Withdraw from Galaxy USDC | 0.04 USDC returned to the wallet; 0.040013096452800700 shares burned | [0x7149b4…](https://explorer.arc.io/tx/0x7149b435ae660aa948ff82a2f72d3247813fae5e65dad050ef1ac778bfb37689) |

After the withdrawal, direct Arc RPC reads returned 0.240091 USDC and 0.010003307400188380 Galaxy shares in the wallet. The quote expired once between share approval and withdrawal; a fresh review succeeded using the exact existing share allowance. This verifies one funded path and one successful withdrawal at that time. It does not prove future withdrawal liquidity, all wallet extensions, or funded execution for the two Gauntlet vaults.
