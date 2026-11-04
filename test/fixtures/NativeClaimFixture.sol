// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Authentic mainnet claim fixture; see native-mainnet-claim.json for provenance.
library NativeClaimFixture {
    address internal constant ACCOUNT = 0x7d5E92853599B792cCb65A6E9B1fC26c663F6563;
    uint256 internal constant AMOUNT = 77145612343297974927676;
    bytes32 internal constant ROOT = 0x0442e07558c3a49da44ffafc43fde948057ee5f5d02c63bbde025369ab4c96fb;

    function proof() internal pure returns (bytes32[] memory p) {
        p = new bytes32[](8);
        p[0] = 0xf884d86eba8698d71c7c5f0f3df7c294f7dd7739014c3285ea027762aa405a3b;
        p[1] = 0x8e61cf2e5efa45f8ac399fa1ba09dd13358bd6e2e76c9a22c9cdb2c6b984ac07;
        p[2] = 0xa84af1183e72792ed47d71a76f94c8a14ff5a0c87c84b7eb53cb75fdff641596;
        p[3] = 0xbbc427ebd914699b0a09c9f623802dd03406327412c802663d7e4944ad9f0bb2;
        p[4] = 0x3c3901a4e159334aaad52eec7c15986d72388e7ddb490d17aaff6d0e0e8b1555;
        p[5] = 0x541538361b32d129af4853847b6088afaa79710434a818339e884a227f6761f1;
        p[6] = 0x2497dbd38c147c8e4014139f7b3efe4638072480e1e50504dd6f44e30e168a1e;
        p[7] = 0x3383773a1dcbbaebd5aceee6bebf3e7046fc09377239e806880bc194b152ce29;
    }
}
