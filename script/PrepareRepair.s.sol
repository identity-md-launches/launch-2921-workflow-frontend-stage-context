// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Script} from "forge-std/Script.sol";
import {NativeSwarmAdapter, INativeSwarm, ISwarmCreditHook} from "../src/auxiliary/NativeSwarmAdapter.sol";
import {WalletQuoter, IQuoteHook} from "../src/auxiliary/WalletQuoter.sol";

/// @notice Dry-run constructor rehearsal only. Intentionally contains no startBroadcast/broadcast.
/// @dev Pass the complete authentic corpus, strictly sorted by account, with amounts in integer wei.
/// Never copy simulated addresses into production config. Use the unsigned Node owner package for
/// externally reviewed deployment. This script does not fund, register or activate any contract.
contract PrepareRepair is Script {
    function run(address native_, address hook_, uint256 round_, address[] memory accounts, uint256[] memory amounts)
        external
        returns (NativeSwarmAdapter simulatedAdapter, WalletQuoter simulatedQuoter)
    {
        require(block.chainid == 1, "Ethereum fork required");
        require(hook_ == 0x4f811b89eF9a19800101705262681F715AC668CC, "Pinned hook mismatch");
        require(native_ == 0x00aEcDb1Da9FaFac4B5717D54C8B9adc860e189a && round_ == 0, "Pinned native round mismatch");
        (bytes32 root, uint256 funded,,) = INativeSwarm(native_).roundOf(round_);
        require(root == 0x0442e07558c3a49da44ffafc43fde948057ee5f5d02c63bbde025369ab4c96fb, "Canonical root mismatch");
        require(funded == 100_000_000e18, "Canonical funding mismatch");
        simulatedAdapter =
            new NativeSwarmAdapter(INativeSwarm(native_), ISwarmCreditHook(hook_), round_, accounts, amounts);
        simulatedQuoter = new WalletQuoter(IQuoteHook(hook_));
    }
}
