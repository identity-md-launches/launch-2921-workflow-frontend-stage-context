// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Arrays} from "@openzeppelin/contracts/utils/Arrays.sol";
import {Hashes} from "@openzeppelin/contracts/utils/cryptography/Hashes.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface INativeSwarm {
    function token() external view returns (address);
    function roundCount() external view returns (uint256);
    function roundOf(uint256 round)
        external
        view
        returns (bytes32 root, uint256 funded, uint256 claimed, uint64 unlocksAt);
    function claimed(uint256 round, address account) external view returns (bool);
}

interface ISwarmCreditHook {
    function token() external view returns (address);
    function swarmDistributor() external view returns (address);
    function creditSwarmClaim(uint256 index, address account, uint256 amount, bytes32[] calldata proof) external;
}

/// @notice Atomic native-proof to legacy-proof bridge. No owner, arbitrary root setter or custody.
/// @dev A transient singleton tree avoids trusting any derived allocation tree. Its sole legacy leaf
/// exists only inside syncClaim, after validation against the immutable native root AND claimed state.
contract NativeSwarmAdapter {
    INativeSwarm public immutable nativeDistributor;
    ISwarmCreditHook public immutable hook;
    uint256 public immutable nativeRound;
    bytes32 public immutable nativeRoot;
    uint256 public immutable nativeFunded;
    uint256 public immutable allocationCount;
    mapping(address => bool) public synced;
    bytes32 public merkleRoot;
    uint256 private activeIndex;
    bool private syncing;
    error InvalidConfiguration();
    error InvalidEvidence();
    error AlreadySynced();
    error Busy();
    event ClaimSynced(uint256 indexed round, address indexed account, uint256 indexed index, uint256 amount);

    /// @param accounts Full canonical allocation, strictly ascending by address (uniqueness is mandatory).
    /// @param amounts Corresponding native amounts in wei. The entire OZ StandardMerkleTree is rebuilt
    /// at deployment to bind uniqueness to the authentic root, not to an owner assertion.
    constructor(
        INativeSwarm native_,
        ISwarmCreditHook hook_,
        uint256 round_,
        address[] memory accounts,
        uint256[] memory amounts
    ) {
        if (
            address(native_).code.length == 0 || address(hook_).code.length == 0 || native_.token() != hook_.token()
                || round_ >= native_.roundCount()
        ) revert InvalidConfiguration();
        (bytes32 root, uint256 funded,,) = native_.roundOf(round_);
        if (root == bytes32(0) || funded == 0) revert InvalidConfiguration();
        if (accounts.length == 0 || accounts.length != amounts.length) revert InvalidConfiguration();
        bytes32[] memory leaves = new bytes32[](accounts.length);
        uint256 sum;
        for (uint256 i; i < accounts.length; ++i) {
            if (accounts[i] == address(0) || (i > 0 && accounts[i] <= accounts[i - 1]) || amounts[i] == 0) {
                revert InvalidConfiguration();
            }
            sum += amounts[i];
            leaves[i] = keccak256(bytes.concat(keccak256(abi.encode(accounts[i], amounts[i]))));
        }
        if (sum > funded) revert InvalidConfiguration();
        Arrays.sort(leaves);
        // OpenZeppelin StandardMerkleTree complete binary heap, sorted leaves in reverse heap order.
        bytes32[] memory tree = new bytes32[](2 * leaves.length - 1);
        for (uint256 i; i < leaves.length; ++i) {
            tree[tree.length - 1 - i] = leaves[i];
        }
        for (uint256 i = leaves.length - 1; i > 0;) {
            --i;
            tree[i] = Hashes.commutativeKeccak256(tree[2 * i + 1], tree[2 * i + 2]);
        }
        if (tree[0] != root) revert InvalidConfiguration();
        allocationCount = accounts.length;
        nativeDistributor = native_;
        hook = hook_;
        nativeRound = round_;
        nativeRoot = root;
        nativeFunded = funded;
    }

    /// @notice Deterministic index commits to adapter domain, native round AND account.
    function indexOf(address account) public view returns (uint256) {
        return uint256(keccak256(abi.encode(address(nativeDistributor), nativeRound, account)));
    }

    /// @notice Legacy claimed flag is true only for the currently authenticated atomic credit.
    function isClaimed(uint256 index) external view returns (bool) {
        return syncing && index == activeIndex;
    }

    /// @notice Anyone may relay an authentic already-completed claim; rights always go to account.
    function syncClaim(address account, uint256 amount, bytes32[] calldata nativeProof) external {
        if (syncing) revert Busy();
        if (synced[account]) revert AlreadySynced();
        if (hook.swarmDistributor() != address(this)) revert InvalidConfiguration();
        (bytes32 currentRoot, uint256 funded,,) = nativeDistributor.roundOf(nativeRound);
        bytes32 nativeLeaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))));
        if (
            account == address(0) || amount == 0 || amount > nativeFunded || currentRoot != nativeRoot
                || funded != nativeFunded || !nativeDistributor.claimed(nativeRound, account)
                || !MerkleProof.verifyCalldata(nativeProof, nativeRoot, nativeLeaf)
        ) revert InvalidEvidence();
        uint256 index = indexOf(account);
        synced[account] = true;
        syncing = true;
        activeIndex = index;
        merkleRoot = keccak256(abi.encodePacked(index, account, amount));
        hook.creditSwarmClaim(index, account, amount, new bytes32[](0));
        merkleRoot = bytes32(0);
        activeIndex = 0;
        syncing = false;
        emit ClaimSynced(nativeRound, account, index, amount);
    }
}
