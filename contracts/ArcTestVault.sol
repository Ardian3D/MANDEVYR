// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice No-yield ERC-4626 fixture for MANDEVYR action tests on Arc Testnet only.
/// @dev No owner, allocator, proxy, or strategy. Do not deploy to mainnet.
contract ArcTestVault is ERC20, ERC4626 {
    constructor(IERC20 asset_) ERC20("MANDEVYR Test Vault Share", "mdvTEST") ERC4626(asset_) {}

    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return super.decimals();
    }

    // A larger virtual-share offset makes empty-vault share inflation uneconomic.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
