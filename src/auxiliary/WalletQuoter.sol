// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

interface IQuoteHook {
    function poolManager() external view returns (IPoolManager);
    function poolKey() external view returns (Currency, Currency, uint24, int24, address);
    function pendingFees() external view returns (uint256);
    function isRouter(address) external view returns (bool);
}

/// @notice Exact-input, official-pool-only quoter. Register as a supported router before sealing.
/// @dev Caller identity is msg.sender, never calldata or tx.origin. Every swap is rolled back, including
/// hook credits, quotas, gates and fee claims. This contract cannot execute/settle/take a swap.
contract WalletQuoter is IUnlockCallback {
    IPoolManager public immutable poolManager;
    IQuoteHook public immutable hook;
    address private caller;
    error InvalidConfiguration();
    error NotCallback();
    error Busy();
    error UnexpectedSuccess();
    error PartialFill();
    error QuoteResult(uint256 amountOut, uint256 rewardFee, uint256 lpFeeInput);

    constructor(IQuoteHook hook_) {
        if (address(hook_).code.length == 0) revert InvalidConfiguration();
        IPoolManager manager = hook_.poolManager();
        if (address(manager).code.length == 0) revert InvalidConfiguration();
        hook = hook_;
        poolManager = manager;
    }

    function msgSender() external view returns (address) {
        return caller;
    }

    function quoteExactInput(bool zeroForOne, uint128 amountIn)
        external
        returns (uint256 amountOut, uint256 rewardFee, uint256 lpFeeInput)
    {
        if (caller != address(0)) revert Busy();
        if (amountIn == 0 || !hook.isRouter(address(this))) revert InvalidConfiguration();
        caller = msg.sender;
        try poolManager.unlock(abi.encode(zeroForOne, amountIn)) returns (bytes memory) {
            revert UnexpectedSuccess();
        } catch (bytes memory reason) {
            caller = address(0);
            if (reason.length != 100 || bytes4(reason) != QuoteResult.selector) {
                assembly ("memory-safe") { revert(add(reason, 32), mload(reason)) }
            }
            assembly ("memory-safe") {
                amountOut := mload(add(reason, 36))
                rewardFee := mload(add(reason, 68))
                lpFeeInput := mload(add(reason, 100))
            }
        }
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager) || caller == address(0)) revert NotCallback();
        (bool zeroForOne, uint128 amountIn) = abi.decode(data, (bool, uint128));
        (Currency c0, Currency c1, uint24 fee, int24 spacing, address hooks) = hook.poolKey();
        if (hooks != address(hook)) revert InvalidConfiguration();
        PoolKey memory key = PoolKey(c0, c1, fee, spacing, IHooks(hooks));
        uint256 feesBefore = hook.pendingFees();
        BalanceDelta delta = poolManager.swap(
            key,
            SwapParams(
                zeroForOne,
                -int256(uint256(amountIn)),
                zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            ),
            ""
        );
        int128 input = zeroForOne ? delta.amount0() : delta.amount1();
        int128 output = zeroForOne ? delta.amount1() : delta.amount0();
        if (input != -int256(uint256(amountIn)) || output <= 0) revert PartialFill();
        uint256 rewardFee = hook.pendingFees() - feesBefore;
        // Pool fee is in input currency. Buy hook fee is removed before pool input.
        bool imdInput = Currency.unwrap(zeroForOne ? c0 : c1) == IQuoteTokenHook(address(hook)).imd();
        uint256 poolInput = imdInput ? uint256(amountIn) - rewardFee : uint256(amountIn);
        // LP fee display is an estimate: tick-by-tick fee rounding may differ by wei.
        revert QuoteResult(uint256(uint128(output)), rewardFee, (poolInput * fee + 999999) / 1000000);
    }
}
import {IHooks} from "v4-core/interfaces/IHooks.sol";

interface IQuoteTokenHook {
    function imd() external view returns (address);
}
