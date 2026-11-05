// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UnlockV2Hook} from "../src/UnlockV2Hook.sol";
import {UnlockV2Token} from "../src/UnlockV2Token.sol";
import {WalletQuoter} from "../src/auxiliary/WalletQuoter.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary, PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";

interface IEthRouteRouter {
    function execute(bytes calldata, bytes[] calldata, uint256) external payable;
}
interface IEthRoutePermit {
    function approve(address, address, uint160, uint48) external;
}

/// Actual installed contracts and actual pools. Activation and balances exist only in this isolated fork.
contract EthRouteForkTest is Test {
    using PoolIdLibrary for PoolKey;
    UnlockV2Hook constant H = UnlockV2Hook(0x4f811b89eF9a19800101705262681F715AC668CC);
    UnlockV2Token constant T = UnlockV2Token(0xbD769D71d535030e47b0A024B8edAE4A923D7819);
    WalletQuoter constant Q = WalletQuoter(0xB36788ea2612B72eB4FE07364c2406AAf47f67a6);
    address constant R = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;
    address constant P = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    PoolKey official;
    PoolKey referenceKey;
    address buyer;
    uint256 extraNative;
    struct Single { PoolKey poolKey; bool zeroForOne; uint128 amountIn; uint128 amountOutMinimum; bytes hookData; }

    function setUp() public {
        if (!vm.envOr("UNLOCK_ETH_FORK", false)) { vm.skip(true); return; }
        vm.createSelectFork(vm.envOr("UNLOCK_ETH_FORK_RPC",string("https://ethereum-rpc.publicnode.com")), vm.envOr("UNLOCK_ETH_FORK_BLOCK",uint256(26347457)));
        buyer = makeAddr("ETH buyer without IMD");
        (Currency a, Currency b, uint24 f, int24 s, IHooks h) = H.poolKey();
        official = PoolKey(a,b,f,s,h);
        referenceKey = PoolKey(Currency.wrap(address(0)), Currency.wrap(H.imd()),10000,200,IHooks(address(0)));
        assertEq(PoolId.unwrap(official.toId()), PoolId.unwrap(H.officialPoolId()));
        assertEq(PoolId.unwrap(referenceKey.toId()), PoolId.unwrap(H.referencePoolId()));
        assertTrue(H.isRouter(R)); assertTrue(H.isRouter(address(Q)));
        assertEq(H.migrationVault().remainingBacking(), H.migrationVault().remainingCapacity());
        assertEq(H.swarmDistributor(), 0x17565820374DE9d122519D5e701E8c2345622058);
        if (!H.activated()) { vm.prank(H.owner()); H.activate(); }
        assertEq(H.gatesOpen(),0);
        vm.deal(buyer, 1 ether);
    }

    function route(uint128 value, uint128 min, uint256 deadline) internal {
        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(Single(referenceKey,true,value,0,""));
        // OPEN_DELTA consumes exactly the IMD credit from the first leg, including all hook deltas.
        params[1] = abi.encode(Single(official,Currency.unwrap(official.currency0)==H.imd(),0,min,""));
        // Settle EXACT native input. A reference partial fill leaves an unsettled credit and reverts.
        // There is deliberately no IMD take/settle: a second-leg partial fill also leaves a delta and reverts.
        params[2] = abi.encode(address(0),uint256(value),false);
        params[3] = abi.encode(address(T),uint256(min));
        bytes[] memory inputs = new bytes[](2);
        inputs[0] = abi.encode(hex"06060b0f",params);
        inputs[1] = abi.encode(address(0),buyer,uint256(0));
        vm.prank(buyer);
        IEthRouteRouter(R).execute{value:uint256(value)+extraNative}(hex"1004",inputs,deadline);
    }

    function sale(uint128 n, uint128 min) internal {
        bytes[] memory params = new bytes[](3);
        params[0]=abi.encode(Single(official,Currency.unwrap(official.currency0)==address(T),n,min,""));
        params[1]=abi.encode(address(T),uint256(n));
        params[2]=abi.encode(H.imd(),uint256(min));
        bytes[] memory inputs = new bytes[](1); inputs[0]=abi.encode(hex"060c0f",params);
        vm.prank(buyer); IEthRouteRouter(R).execute(hex"10",inputs,block.timestamp+120);
    }

    function routeExternal(uint128 n,uint128 min,uint256 deadline) external { route(n,min,deadline); }
    function saleExternal(uint128 n,uint128 min) external { sale(n,min); }

    function testETHActualBuyerCreditMatures20PercentAllowedAndExcessSale() public {
        assertEq(IERC20(H.imd()).balanceOf(buyer),0);
        assertEq(IERC20(H.imd()).allowance(buyer,P),0);
        uint256 routerCredit=H.rightsOf(R).pendingBuy;
        uint256 beforeEth=buyer.balance;
        route(0.00001 ether,1,block.timestamp+120);
        uint256 bought=T.balanceOf(buyer); assertGt(bought,0);
        assertEq(beforeEth-buyer.balance,0.00001 ether);
        assertEq(H.rightsOf(buyer).pendingBuy,bought,"ACTUAL buyer credited");
        assertEq(H.rightsOf(R).pendingBuy,routerCredit,"router receives no credit");
        assertEq(H.sellAllowance(buyer),0,"credit not mature in buying block");
        assertEq(IERC20(H.imd()).balanceOf(buyer),0,"no pre-owned or residual IMD");
        assertEq(T.balanceOf(R),0);
        vm.roll(block.number+1); vm.warp(block.timestamp+12);
        assertEq(H.gatesOpen(),0);
        uint256 allowed=bought*20/100;
        assertEq(H.sellAllowance(buyer),allowed,"20% cumulative entitlement at gate zero");
        vm.startPrank(buyer);
        T.approve(P,type(uint256).max);
        IEthRoutePermit(P).approve(address(T),R,type(uint160).max,uint48(block.timestamp+3600));
        vm.stopPrank();
        vm.prank(buyer); (uint256 out,,)=Q.quoteExactInput(true,uint128(allowed/2));
        sale(uint128(allowed/2),uint128(out));
        assertEq(H.rightsOf(buyer).buySold,allowed/2);
        assertEq(H.sellAllowance(buyer),allowed-allowed/2);
        uint256 excess=H.sellAllowance(buyer)+1;
        vm.expectRevert(); this.saleExternal(uint128(excess),0);
        assertEq(H.rightsOf(buyer).buySold,allowed/2,"failed sale preserves counters");
    }

    function testETHMinimumAndDeadlineRevertAtomically() public {
        uint256 beforeEth=buyer.balance;
        vm.expectRevert(); this.routeExternal(0.00001 ether,type(uint128).max,block.timestamp+120);
        assertEq(buyer.balance,beforeEth); assertEq(T.balanceOf(buyer),0); assertEq(H.rightsOf(buyer).pendingBuy,0);
        vm.expectRevert(); this.routeExternal(0.00001 ether,1,block.timestamp-1);
        assertEq(buyer.balance,beforeEth);
    }

    function testETHUnusedNativeIsRefundedToBuyer() public {
        extraNative=0.000003 ether;
        uint256 beforeEth=buyer.balance;
        route(0.00001 ether,1,block.timestamp+120);
        assertEq(beforeEth-buyer.balance,0.00001 ether,"surplus returned to actual buyer");
        assertEq(IERC20(H.imd()).balanceOf(buyer),0);
        assertGt(T.balanceOf(buyer),0);
    }

    function testIMDInstalledQuoterMatchesActualRouterBuyAndSell() public {
        deal(H.imd(),buyer,1e18);
        vm.startPrank(buyer);
        IERC20(H.imd()).approve(P,type(uint256).max);
        IEthRoutePermit(P).approve(H.imd(),R,type(uint160).max,uint48(block.timestamp+3600));
        (uint256 out,,)=Q.quoteExactInput(false,0.01e18);
        vm.stopPrank();
        bytes[] memory params=new bytes[](3);
        params[0]=abi.encode(Single(official,false,0.01e18,uint128(out),""));
        params[1]=abi.encode(H.imd(),uint256(0.01e18));
        params[2]=abi.encode(address(T),out);
        bytes[] memory inputs=new bytes[](1);inputs[0]=abi.encode(hex"060c0f",params);
        vm.prank(buyer);IEthRouteRouter(R).execute(hex"10",inputs,block.timestamp+120);
        assertEq(T.balanceOf(buyer),out); assertEq(H.rightsOf(buyer).pendingBuy,out);
        vm.roll(block.number+1);
        assertEq(H.sellAllowance(buyer),out*20/100);
    }
}
