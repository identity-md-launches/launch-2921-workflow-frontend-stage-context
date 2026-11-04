// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {BaseTest} from "./Base.t.sol";
import {NativeSwarmAdapter, INativeSwarm, ISwarmCreditHook} from "../src/auxiliary/NativeSwarmAdapter.sol";
import {WalletQuoter, IQuoteHook} from "../src/auxiliary/WalletQuoter.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {Hashes} from "@openzeppelin/contracts/utils/cryptography/Hashes.sol";

/// @dev Mock native distributor implements the actual round-based ABI, NOT legacy ABI.
contract NativeFixture is INativeSwarm {
    address public token;
    uint256 public roundCount = 1;
    bytes32 public root;
    uint256 public funded;
    mapping(uint256 => mapping(address => bool)) public claimed;

    constructor(address t, bytes32 r, uint256 f) {
        token = t;
        root = r;
        funded = f;
    }

    function roundOf(uint256 r) external view returns (bytes32, uint256, uint256, uint64) {
        require(r == 0);
        return (root, funded, 0, 0);
    }

    function setClaimed(address a, bool yes) external {
        claimed[0][a] = yes;
    }

    function setRoot(bytes32 r) external {
        root = r;
    }
}

contract RepairTest is BaseTest {
    NativeFixture native;
    NativeSwarmAdapter adapter;
    WalletQuoter quoter;
    bytes32 aliceLeaf;
    bytes32 bobLeaf;
    uint256 constant ALICE_AMOUNT = 17_000e18;
    uint256 constant BOB_AMOUNT = 23_000e18;

    function setUp() public override {
        super.setUp();
        aliceLeaf = keccak256(bytes.concat(keccak256(abi.encode(alice, ALICE_AMOUNT))));
        bobLeaf = keccak256(bytes.concat(keccak256(abi.encode(bob, BOB_AMOUNT))));
        native = new NativeFixture(
            address(token), Hashes.commutativeKeccak256(aliceLeaf, bobLeaf), ALICE_AMOUNT + BOB_AMOUNT
        );
        (address[] memory accounts, uint256[] memory amounts) = allocations();
        adapter = new NativeSwarmAdapter(native, ISwarmCreditHook(address(hook)), 0, accounts, amounts);
        quoter = new WalletQuoter(IQuoteHook(address(hook)));
        vm.startPrank(OWNER);
        hook.setSwarmDistributor(address(adapter));
        hook.setRouter(address(quoter), true);
        vm.stopPrank();
    }

    function allocations() internal view returns (address[] memory a, uint256[] memory n) {
        a = new address[](2);
        n = new uint256[](2);
        a[0] = alice < bob ? alice : bob;
        a[1] = alice < bob ? bob : alice;
        n[0] = alice < bob ? ALICE_AMOUNT : BOB_AMOUNT;
        n[1] = alice < bob ? BOB_AMOUNT : ALICE_AMOUNT;
    }

    function proof() internal view returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = bobLeaf;
    }

    function testNativeClaimSyncAndReplay() public {
        native.setClaimed(alice, true);
        adapter.syncClaim(alice, ALICE_AMOUNT, proof());
        assertEq(hook.rightsOf(alice).otherCredited, ALICE_AMOUNT);
        assertTrue(hook.swarmIndexCredited(adapter.indexOf(alice)));
        assertEq(adapter.merkleRoot(), bytes32(0));
        assertFalse(adapter.isClaimed(adapter.indexOf(alice)));
        vm.expectRevert(NativeSwarmAdapter.AlreadySynced.selector);
        adapter.syncClaim(alice, ALICE_AMOUNT, proof());
    }

    function testBooleanAloneAndAlternateAmountCannotCredit() public {
        vm.expectRevert(NativeSwarmAdapter.InvalidEvidence.selector);
        adapter.syncClaim(alice, ALICE_AMOUNT, proof());
        native.setClaimed(alice, true);
        vm.expectRevert(NativeSwarmAdapter.InvalidEvidence.selector);
        adapter.syncClaim(alice, ALICE_AMOUNT + 1, proof());
        vm.expectRevert(NativeSwarmAdapter.InvalidEvidence.selector);
        adapter.syncClaim(bob, ALICE_AMOUNT, proof());
        bytes32[] memory forged = new bytes32[](1);
        forged[0] = bytes32(uint256(123));
        vm.expectRevert(NativeSwarmAdapter.InvalidEvidence.selector);
        adapter.syncClaim(alice, ALICE_AMOUNT, forged);
        assertFalse(adapter.synced(alice));
    }

    function testCanonicalTreeMustBeCompleteAndUnique() public {
        (address[] memory a, uint256[] memory n) = allocations();
        n[0] += 1;
        vm.expectRevert(NativeSwarmAdapter.InvalidConfiguration.selector);
        new NativeSwarmAdapter(native, ISwarmCreditHook(address(hook)), 0, a, n);
        n[0] -= 1;
        a[1] = a[0];
        // Even if a malicious native root had two different allocations for one account,
        // the adapter may not authenticate claimed=true as evidence for either amount.
        native.setRoot(
            Hashes.commutativeKeccak256(
                keccak256(bytes.concat(keccak256(abi.encode(a[0], n[0])))),
                keccak256(bytes.concat(keccak256(abi.encode(a[1], n[1]))))
            )
        );
        vm.expectRevert(NativeSwarmAdapter.InvalidConfiguration.selector);
        new NativeSwarmAdapter(native, ISwarmCreditHook(address(hook)), 0, a, n);
    }

    function testDirectLegacyForgeryAndRootMutation() public {
        native.setClaimed(alice, true);
        uint256 index = adapter.indexOf(alice);
        vm.expectRevert();
        hook.creditSwarmClaim(index, alice, ALICE_AMOUNT, new bytes32[](0));
        native.setRoot(bytes32(uint256(9)));
        vm.expectRevert(NativeSwarmAdapter.InvalidEvidence.selector);
        adapter.syncClaim(alice, ALICE_AMOUNT, proof());
    }

    function testBurnBeforeSyncIsNetted() public {
        fullLaunch();
        token.transfer(alice, ALICE_AMOUNT);
        vm.prank(alice);
        token.burn(100e18);
        native.setClaimed(alice, true);
        adapter.syncClaim(alice, ALICE_AMOUNT, proof());
        assertEq(hook.rightsOf(alice).otherCredited, ALICE_AMOUNT - 100e18);
    }

    function testQuoteUsesWalletRightsAndRollsBackAllState() public {
        fullLaunch();
        giveImd(alice, 1000e18);
        buy(alice, -int256(10e18));
        vm.roll(block.number + 1);
        uint128 sellAmount = uint128(hook.sellAllowance(alice) / 2);
        uint256 fees = hook.pendingFees();
        uint256 volume = hook.cumulativeVolumeUsd();
        uint256 sold = hook.rightsOf(alice).buySold;
        vm.prank(alice);
        (uint256 out, uint256 rewardFee, uint256 lpInput) = quoter.quoteExactInput(tokenIs0, sellAmount);
        assertGt(out, 0);
        assertGt(rewardFee, 0);
        assertGt(lpInput, 0);
        assertEq(hook.pendingFees(), fees);
        assertEq(hook.cumulativeVolumeUsd(), volume);
        assertEq(hook.rightsOf(alice).buySold, sold);
        assertEq(quoter.msgSender(), address(0));
        BalanceDelta executed = sell(alice, -int256(uint256(sellAmount)));
        assertEq(uint256(uint128(imdAmt(executed))), out, "actual router-semantics output must equal quote");
        assertEq(hook.pendingFees() - fees, rewardFee);
        vm.prank(bob);
        vm.expectRevert();
        quoter.quoteExactInput(tokenIs0, sellAmount);
    }

    function testBuyQuoteMatchesSettlementAndCallbackCannotBeForged() public {
        fullLaunch();
        giveImd(alice, 1000e18);
        vm.prank(alice);
        (uint256 out,,) = quoter.quoteExactInput(!tokenIs0, uint128(10e18));
        BalanceDelta executed = buy(alice, -int256(10e18));
        assertEq(uint256(uint128(tokAmt(executed))), out);
        vm.expectRevert(WalletQuoter.NotCallback.selector);
        quoter.unlockCallback(abi.encode(tokenIs0, uint128(1e18)));
    }

    function testQuoteCannotOpenClosedTrading() public {
        vm.expectRevert();
        quoter.quoteExactInput(tokenIs0, uint128(1e18));
        assertFalse(hook.activated());
    }

    function testReplacementAdapterCannotReplaySameNativeRound() public {
        native.setClaimed(alice, true);
        adapter.syncClaim(alice, ALICE_AMOUNT, proof());
        (address[] memory a, uint256[] memory n) = allocations();
        NativeSwarmAdapter replacement = new NativeSwarmAdapter(native, ISwarmCreditHook(address(hook)), 0, a, n);
        assertEq(replacement.indexOf(alice), adapter.indexOf(alice));
        vm.prank(OWNER);
        hook.setSwarmDistributor(address(replacement));
        vm.expectRevert();
        replacement.syncClaim(alice, ALICE_AMOUNT, proof());
        assertFalse(replacement.synced(alice), "hook failure must roll back adapter state");
        assertEq(replacement.merkleRoot(), bytes32(0));
        assertEq(hook.rightsOf(alice).otherCredited, ALICE_AMOUNT);
    }

    function testQuoterCannotSpendSameBlockPendingBuyRights() public {
        fullLaunch();
        giveImd(alice, 1000e18);
        buy(alice, -int256(10e18));
        vm.prank(alice);
        vm.expectRevert();
        quoter.quoteExactInput(tokenIs0, uint128(1e18));
        assertEq(hook.rightsOf(alice).buySold, 0);
    }

    function testUnregisteredQuoterNeverFallsBackToSharedIdentity() public {
        vm.prank(OWNER);
        hook.setRouter(address(quoter), false);
        fullLaunch();
        giveImd(alice, 1000e18);
        vm.prank(alice);
        vm.expectRevert(WalletQuoter.InvalidConfiguration.selector);
        quoter.quoteExactInput(!tokenIs0, uint128(1e18));
    }
}
