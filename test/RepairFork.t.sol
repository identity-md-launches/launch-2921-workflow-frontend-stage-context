// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {NativeClaimFixture} from "./fixtures/NativeClaimFixture.sol";
import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {UnlockV2Hook} from "../src/UnlockV2Hook.sol";
import {UnlockV2Token} from "../src/UnlockV2Token.sol";
import {MigrationVault} from "../src/MigrationVault.sol";
import {RewardPot} from "../src/RewardPot.sol";
import {WalletQuoter, IQuoteHook} from "../src/auxiliary/WalletQuoter.sol";
import {INativeSwarm} from "../src/auxiliary/NativeSwarmAdapter.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";

interface IUniversalRouterRepair {
    function execute(bytes calldata, bytes[] calldata, uint256) external payable;
}

interface IPermit2Repair {
    function approve(address, address, uint160, uint48) external;
}

interface IStockQuoterRepair {
    struct Params {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 exactAmount;
        bytes hookData;
    }
    function quoteExactInputSingle(Params calldata) external returns (uint256, uint256);
}

/// @notice Opt-in network test. All setup below occurs ONLY inside an isolated fork, never mainnet.
/// Synthetic trader funding is explicitly confined to this test; deployed token/hook are untouched.
contract RepairForkTest is Test {
    UnlockV2Hook hook = UnlockV2Hook(0x4f811b89eF9a19800101705262681F715AC668CC);
    UnlockV2Token token = UnlockV2Token(0xbD769D71d535030e47b0A024B8edAE4A923D7819);
    address constant ROUTER = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;
    address constant STOCK = 0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant NATIVE = 0x00aEcDb1Da9FaFac4B5717D54C8B9adc860e189a;

    struct ExactInputSingle {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        bytes hookData;
    }
    WalletQuoter quoter;
    PoolKey key;
    address trader;
    address imd;
    bool token0;

    function setUp() public {
        if (!vm.envOr("UNLOCK_REPAIR_FORK", false)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(vm.envOr("UNLOCK_REPAIR_RPC_URL", string("https://ethereum-rpc.publicnode.com")), 26339867);
        trader = makeAddr("fork trader");
        assertFalse(hook.activated());
        assertEq(hook.gatesOpen(), 0);
        (Currency c0, Currency c1, uint24 fee, int24 spacing, IHooks hooks) = hook.poolKey();
        key = PoolKey(c0, c1, fee, spacing, hooks);
        imd = hook.imd();
        token0 = Currency.unwrap(c0) == address(token);
        quoter = new WalletQuoter(IQuoteHook(address(hook)));
        vm.startPrank(hook.owner());
        token.transfer(address(hook.migrationVault()), 700_000_000e18);
        hook.setRouter(ROUTER, true);
        hook.setRouter(address(quoter), true);
        // No fake adapter registration. Native sync is separately blocked pending complete corpus.
        // activate() permits missing distributor; this fork isolates quote behavior only.
        hook.activate();
        vm.stopPrank();
        deal(imd, trader, 10e18);
        vm.startPrank(trader);
        IERC20(imd).approve(PERMIT2, 10e18);
        token.approve(PERMIT2, type(uint128).max);
        IPermit2Repair(PERMIT2).approve(imd, ROUTER, uint160(10e18), uint48(block.timestamp + 1 days));
        IPermit2Repair(PERMIT2).approve(address(token), ROUTER, type(uint128).max, uint48(block.timestamp + 1 days));
        vm.stopPrank();
    }

    function execute(address input, uint128 n, uint128 min) internal {
        bool zeroForOne = input == Currency.unwrap(key.currency0);
        bytes[] memory actions = new bytes[](3);
        actions[0] = abi.encode(ExactInputSingle(key, zeroForOne, n, min, bytes("")));
        actions[1] = abi.encode(input, uint256(n));
        actions[2] = abi.encode(zeroForOne ? key.currency1 : key.currency0, uint256(min));
        bytes[] memory commands = new bytes[](1);
        commands[0] = abi.encode(hex"060c0f", actions);
        vm.prank(trader);
        IUniversalRouterRepair(ROUTER).execute(hex"10", commands, block.timestamp + 600);
    }

    function testForkActualUniversalRouterBuySellQuoteIdentity() public {
        vm.prank(trader);
        (uint256 expectedBuy,,) = quoter.quoteExactInput(!token0, uint128(0.1e18));
        uint256 before = token.balanceOf(trader);
        execute(imd, uint128(0.1e18), uint128(expectedBuy));
        assertEq(token.balanceOf(trader) - before, expectedBuy, "actual mainnet UniversalRouter buy");
        vm.roll(block.number + 1);
        uint128 sellAmount = uint128(hook.sellAllowance(trader) / 2);
        assertGt(sellAmount, 0);
        vm.prank(trader);
        (uint256 expectedSell, uint256 fee,) = quoter.quoteExactInput(token0, sellAmount);
        uint256 fees = hook.pendingFees();
        before = IERC20(imd).balanceOf(trader);
        execute(address(token), sellAmount, uint128(expectedSell));
        assertEq(IERC20(imd).balanceOf(trader) - before, expectedSell, "actual mainnet UniversalRouter sell");
        assertEq(hook.pendingFees() - fees, fee);
        vm.prank(trader);
        vm.expectRevert();
        IStockQuoterRepair(STOCK).quoteExactInputSingle(IStockQuoterRepair.Params(key, token0, sellAmount, ""));
        vm.prank(makeAddr("no rights"));
        vm.expectRevert();
        quoter.quoteExactInput(token0, sellAmount);
    }

    function testForkMigrationContributionStaleGateAndWeeklyRewards() public {
        MigrationVault vault = hook.migrationVault();
        deal(address(vault.v1()), trader, 100e18);
        vm.startPrank(trader);
        vault.v1().approve(address(vault), 100e18);
        vault.migrate(100e18);
        assertEq(token.balanceOf(trader), 100e18);
        assertEq(hook.rightsOf(trader).otherCredited, 100e18);
        token.contribute(1, 1e18);
        vm.stopPrank();
        uint256 total = hook.rewardPot().totalPoints();
        assertEq(total, 1e18);
        vm.prank(hook.owner());
        token.contribute(1, 25_000_000e18 - 1e18);
        assertEq(hook.gatesOpen(), 1);
        vm.prank(trader);
        vm.expectRevert();
        token.contribute(1, 1e18);
        vm.prank(trader);
        token.burn(1e18);
        assertEq(hook.rewardPot().points(trader), 2e18);
        execute(imd, uint128(0.1e18), 1);
        hook.redeemFees();
        RewardPot pot = hook.rewardPot();
        vm.warp(block.timestamp + 8 days);
        (uint256 claimable,) = pot.rewardsOf(trader);
        assertGt(claimable, 0);
        uint256 before = IERC20(imd).balanceOf(trader);
        vm.prank(trader);
        pot.claim();
        assertEq(IERC20(imd).balanceOf(trader) - before, claimable);
    }

    function testForkAuthenticNativeClaimProofAndLegacyIncompatibility() public {
        address account = NativeClaimFixture.ACCOUNT;
        uint256 n = NativeClaimFixture.AMOUNT;
        bytes32[] memory proof = NativeClaimFixture.proof();
        (bytes32 root, uint256 funded,,) = INativeSwarm(NATIVE).roundOf(0);
        assertEq(root, NativeClaimFixture.ROOT);
        assertEq(funded, 100_000_000e18);
        assertTrue(INativeSwarm(NATIVE).claimed(0, account));
        assertEq(INativeSwarm(NATIVE).token(), address(token));
        assertTrue(MerkleProof.verify(proof, root, keccak256(bytes.concat(keccak256(abi.encode(account, n))))));
        (bool ok,) = NATIVE.staticcall(abi.encodeWithSignature("merkleRoot()"));
        assertFalse(ok);
        (ok,) = NATIVE.staticcall(abi.encodeWithSignature("isClaimed(uint256)", 0));
        assertFalse(ok);
    }
}
import {IHooks} from "v4-core/interfaces/IHooks.sol";
