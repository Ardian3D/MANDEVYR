// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20P2 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IERC4626P2 {
    function asset() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

/// @notice Testnet-only integration fixture. It locks the vault and asset at deployment.
/// It is not an audited production contract. Mainnet deployment is out of scope.
contract GuardedVaultRouter {
    address public immutable vault;
    address public immutable asset;

    constructor(address vault_, address asset_) {
        require(vault_ != address(0) && asset_ != address(0), "ZERO_ADDRESS");
        require(IERC4626P2(vault_).asset() == asset_, "ASSET_MISMATCH");
        vault = vault_;
        asset = asset_;
    }

    function deposit(uint256 assets, uint256 minShares, address receiver) external returns (uint256 shares) {
        require(assets > 0 && minShares > 0 && receiver == msg.sender, "INVALID_INPUT");
        uint256 beforeBalance = IERC20P2(asset).balanceOf(address(this));
        require(IERC20P2(asset).transferFrom(msg.sender, address(this), assets), "TRANSFER_FAILED");
        require(IERC20P2(asset).balanceOf(address(this)) - beforeBalance == assets, "FEE_ON_TRANSFER");
        require(IERC20P2(asset).approve(vault, 0), "RESET_FAILED");
        require(IERC20P2(asset).approve(vault, assets), "APPROVE_FAILED");
        shares = IERC4626P2(vault).deposit(assets, receiver);
        require(shares >= minShares, "MIN_SHARES");
        require(IERC20P2(asset).approve(vault, 0), "RESET_FAILED");
    }
}
