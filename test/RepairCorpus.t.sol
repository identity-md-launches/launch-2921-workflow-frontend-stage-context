// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {BaseTest} from "./Base.t.sol";
import {NativeFixture} from "./Repair.t.sol";
import {NativeSwarmAdapter, ISwarmCreditHook} from "../src/auxiliary/NativeSwarmAdapter.sol";

/// @dev Independent cross-language five-leaf fixture; uneven heap shape, not a production corpus.
contract RepairCorpusTest is BaseTest {
    function testUnevenFullCorpusAndAllNativeProofs() public {
        address[] memory a = new address[](5);
        uint256[] memory n = new uint256[](5);
        for (uint256 i; i < 5; i++) {
            a[i] = address(uint160(i + 1));
            n[i] = (i + 1) * 123;
        }
        NativeFixture native =
            new NativeFixture(address(token), 0x94e2aee6c0556d7da7c897f8d2110a8e8fc4fd64ff55448ef927adc29873b2d5, 1845);
        NativeSwarmAdapter adapter = new NativeSwarmAdapter(native, ISwarmCreditHook(address(hook)), 0, a, n);
        assertEq(adapter.allocationCount(), 5);
        vm.prank(OWNER);
        hook.setSwarmDistributor(address(adapter));
        {
            bytes32[] memory proof = new bytes32[](3);
            proof[0] = 0x488ca18837d8d5ab7dd708b22863688a688d0017ddd0b29ad32dd1e174de5b98;
            proof[1] = 0x95759ae6cca21608ea5b1356f83dfb487e42b41f14b4c04b28c34b12942bf7bf;
            proof[2] = 0x3b10ef522fa4712c09d4f21cd45774d7b17889bd3ca1c5c36ea5267aee1eba0c;
            native.setClaimed(0x0000000000000000000000000000000000000003, true);
            adapter.syncClaim(0x0000000000000000000000000000000000000003, 369, proof);
            assertEq(hook.rightsOf(0x0000000000000000000000000000000000000003).otherCredited, 369);
        }
        {
            bytes32[] memory proof = new bytes32[](3);
            proof[0] = 0x3b1f52bd8b18512a87f92ce1cd7639a6127404cf9124b39e7025bb25131ba041;
            proof[1] = 0x95759ae6cca21608ea5b1356f83dfb487e42b41f14b4c04b28c34b12942bf7bf;
            proof[2] = 0x3b10ef522fa4712c09d4f21cd45774d7b17889bd3ca1c5c36ea5267aee1eba0c;
            native.setClaimed(0x0000000000000000000000000000000000000001, true);
            adapter.syncClaim(0x0000000000000000000000000000000000000001, 123, proof);
            assertEq(hook.rightsOf(0x0000000000000000000000000000000000000001).otherCredited, 123);
        }
        {
            bytes32[] memory proof = new bytes32[](2);
            proof[0] = 0x8ffa3cbb56ccc126489ebbd5d73fded553a8f13238ae52372c2bc299481986aa;
            proof[1] = 0x440cf50329d2cf307c780420ef47612f54abc3bc1ad43fccbb2ae3c78c79169f;
            native.setClaimed(0x0000000000000000000000000000000000000005, true);
            adapter.syncClaim(0x0000000000000000000000000000000000000005, 615, proof);
            assertEq(hook.rightsOf(0x0000000000000000000000000000000000000005).otherCredited, 615);
        }
        {
            bytes32[] memory proof = new bytes32[](2);
            proof[0] = 0x86e8961862cf93875b122094a0496b5af4b489eb84c42b8700e37bdaee42a933;
            proof[1] = 0x440cf50329d2cf307c780420ef47612f54abc3bc1ad43fccbb2ae3c78c79169f;
            native.setClaimed(0x0000000000000000000000000000000000000002, true);
            adapter.syncClaim(0x0000000000000000000000000000000000000002, 246, proof);
            assertEq(hook.rightsOf(0x0000000000000000000000000000000000000002).otherCredited, 246);
        }
        {
            bytes32[] memory proof = new bytes32[](2);
            proof[0] = 0xbc4bdfff14648d78f274a3db788b32953c276c59b38756d995bfbd821090782a;
            proof[1] = 0x3b10ef522fa4712c09d4f21cd45774d7b17889bd3ca1c5c36ea5267aee1eba0c;
            native.setClaimed(0x0000000000000000000000000000000000000004, true);
            adapter.syncClaim(0x0000000000000000000000000000000000000004, 492, proof);
            assertEq(hook.rightsOf(0x0000000000000000000000000000000000000004).otherCredited, 492);
        }
    }
}
