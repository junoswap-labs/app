// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {CreatorFeeDistributor} from "../src/CreatorFeeDistributor.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract CreatorFeeDistributorTest is Test {
    CreatorFeeDistributor internal dist;
    MockERC20 internal kkub;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal treasury = address(0x7EEA);
    address internal outsider = address(0x0507);

    uint256 internal constant CLAIM_WINDOW = 21 days; // 3 * 7-day epochs
    uint256 internal constant ALICE_REWARD = 40 ether;
    uint256 internal constant BOB_REWARD = 60 ether;
    uint256 internal constant FUND = ALICE_REWARD + BOB_REWARD;

    function setUp() public {
        kkub = new MockERC20();
        // admin == this test contract: holds DEFAULT_ADMIN_ROLE + PUBLISHER_ROLE.
        dist = new CreatorFeeDistributor(address(kkub), CLAIM_WINDOW, address(this));
        kkub.mint(address(this), 1_000 ether);
        kkub.approve(address(dist), type(uint256).max);
    }

    // ─── Merkle helpers ────────────────────────────────────────────────
    // Mirror the OZ StandardMerkleTree encoding the contract verifies against:
    // leaf = keccak256(keccak256(abi.encode(account, amount))); pairs hashed commutatively.

    function _leaf(address account, uint256 amount) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(account, amount))));
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    // Two-leaf tree over (alice, ALICE_REWARD) and (bob, BOB_REWARD).
    function _twoLeafRoot() internal view returns (bytes32) {
        return _hashPair(_leaf(alice, ALICE_REWARD), _leaf(bob, BOB_REWARD));
    }

    function _proofForAlice() internal view returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = _leaf(bob, BOB_REWARD); // alice's sibling
    }

    function _proofForBob() internal view returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = _leaf(alice, ALICE_REWARD);
    }

    function _publishTwoLeaf(uint256 epochId) internal {
        dist.publishEpoch(epochId, _twoLeafRoot(), FUND);
    }

    // ─── publishEpoch ──────────────────────────────────────────────────

    function testPublishFundsAndStores() public {
        _publishTwoLeaf(1);
        (bytes32 root, uint256 funded, uint256 claimed, uint256 publishedAt, bool reclaimed) =
            dist.epochs(1);
        assertEq(root, _twoLeafRoot());
        assertEq(funded, FUND);
        assertEq(claimed, 0);
        assertEq(publishedAt, block.timestamp);
        assertFalse(reclaimed);
        assertEq(kkub.balanceOf(address(dist)), FUND, "escrow holds funds");
        assertEq(dist.latestEpoch(), 1);
    }

    function testPublishMustIncrease() public {
        _publishTwoLeaf(2);
        vm.expectRevert("epoch not increasing");
        _publishTwoLeaf(2);
        vm.expectRevert("epoch not increasing");
        _publishTwoLeaf(1);
    }

    function testPublishEmptyRootReverts() public {
        vm.expectRevert("empty root");
        dist.publishEpoch(1, bytes32(0), FUND);
    }

    function testPublishOnlyPublisher() public {
        vm.prank(outsider);
        vm.expectRevert();
        dist.publishEpoch(1, _twoLeafRoot(), FUND);
    }

    // ─── claim ─────────────────────────────────────────────────────────

    function testClaimTwoLeaf() public {
        _publishTwoLeaf(1);

        vm.prank(alice);
        dist.claim(1, ALICE_REWARD, _proofForAlice());
        assertEq(kkub.balanceOf(alice), ALICE_REWARD);

        vm.prank(bob);
        dist.claim(1, BOB_REWARD, _proofForBob());
        assertEq(kkub.balanceOf(bob), BOB_REWARD);

        (,, uint256 claimed,,) = dist.epochs(1);
        assertEq(claimed, FUND, "all claimed");
        assertEq(kkub.balanceOf(address(dist)), 0, "escrow drained");
    }

    // Single-leaf epoch: root == leaf, empty proof. Guards the degenerate tree the settlement
    // job produces when only one creator cleared the payout threshold in an epoch.
    function testClaimSingleLeaf() public {
        bytes32 root = _leaf(alice, ALICE_REWARD);
        dist.publishEpoch(1, root, ALICE_REWARD);

        vm.prank(alice);
        dist.claim(1, ALICE_REWARD, new bytes32[](0));
        assertEq(kkub.balanceOf(alice), ALICE_REWARD);
    }

    function testClaimWrongAmountReverts() public {
        _publishTwoLeaf(1);
        vm.prank(alice);
        vm.expectRevert("invalid proof");
        dist.claim(1, ALICE_REWARD + 1, _proofForAlice());
    }

    function testClaimWrongClaimantReverts() public {
        _publishTwoLeaf(1);
        // outsider presents alice's amount+proof; leaf hashes over msg.sender so it fails.
        vm.prank(outsider);
        vm.expectRevert("invalid proof");
        dist.claim(1, ALICE_REWARD, _proofForAlice());
    }

    function testClaimTwiceReverts() public {
        _publishTwoLeaf(1);
        vm.startPrank(alice);
        dist.claim(1, ALICE_REWARD, _proofForAlice());
        vm.expectRevert("already claimed");
        dist.claim(1, ALICE_REWARD, _proofForAlice());
        vm.stopPrank();
    }

    function testClaimUnpublishedReverts() public {
        vm.prank(alice);
        vm.expectRevert("epoch not published");
        dist.claim(99, ALICE_REWARD, _proofForAlice());
    }

    function testClaimAtWindowEdgeStillWorks() public {
        _publishTwoLeaf(1);
        vm.warp(block.timestamp + CLAIM_WINDOW); // inclusive boundary (<=)
        vm.prank(alice);
        dist.claim(1, ALICE_REWARD, _proofForAlice());
        assertEq(kkub.balanceOf(alice), ALICE_REWARD);
    }

    function testClaimAfterWindowReverts() public {
        _publishTwoLeaf(1);
        vm.warp(block.timestamp + CLAIM_WINDOW + 1);
        vm.prank(alice);
        vm.expectRevert("claim window closed");
        dist.claim(1, ALICE_REWARD, _proofForAlice());
    }

    function testClaimManyAcrossEpochs() public {
        _publishTwoLeaf(1);
        _publishTwoLeaf(2);

        CreatorFeeDistributor.ClaimInput[] memory batch =
            new CreatorFeeDistributor.ClaimInput[](2);
        batch[0] = CreatorFeeDistributor.ClaimInput(1, ALICE_REWARD, _proofForAlice());
        batch[1] = CreatorFeeDistributor.ClaimInput(2, ALICE_REWARD, _proofForAlice());

        vm.prank(alice);
        dist.claimMany(batch);
        assertEq(kkub.balanceOf(alice), ALICE_REWARD * 2);
    }

    // ─── reclaim (forfeiture) ──────────────────────────────────────────

    // Bob never claims; after the window the treasury sweeps only his unclaimed remainder.
    function testReclaimForfeitsUnclaimed() public {
        _publishTwoLeaf(1);
        vm.prank(alice);
        dist.claim(1, ALICE_REWARD, _proofForAlice());

        vm.warp(block.timestamp + CLAIM_WINDOW + 1);
        dist.reclaim(1, treasury);

        assertEq(kkub.balanceOf(treasury), BOB_REWARD, "only unclaimed swept");
        assertEq(kkub.balanceOf(address(dist)), 0);
        (,,,, bool reclaimed) = dist.epochs(1);
        assertTrue(reclaimed);
    }

    function testReclaimBeforeWindowReverts() public {
        _publishTwoLeaf(1);
        vm.warp(block.timestamp + CLAIM_WINDOW); // still open at the boundary
        vm.expectRevert("window still open");
        dist.reclaim(1, treasury);
    }

    function testReclaimTwiceReverts() public {
        _publishTwoLeaf(1);
        vm.warp(block.timestamp + CLAIM_WINDOW + 1);
        dist.reclaim(1, treasury);
        vm.expectRevert("already reclaimed");
        dist.reclaim(1, treasury);
    }

    function testReclaimOnlyAdmin() public {
        _publishTwoLeaf(1);
        vm.warp(block.timestamp + CLAIM_WINDOW + 1);
        vm.prank(outsider);
        vm.expectRevert();
        dist.reclaim(1, treasury);
    }

    // A creator whose window is still open must not have their reward swept by a reclaim on a
    // *different*, already-expired epoch — reclaim is strictly per-epoch.
    function testClaimStillWorksAfterOtherEpochReclaimed() public {
        _publishTwoLeaf(1);
        vm.warp(block.timestamp + CLAIM_WINDOW + 1);
        _publishTwoLeaf(2); // fresh window
        dist.reclaim(1, treasury); // sweep the expired epoch 1

        vm.prank(alice);
        dist.claim(2, ALICE_REWARD, _proofForAlice());
        assertEq(kkub.balanceOf(alice), ALICE_REWARD);
    }

    // ─── pause ─────────────────────────────────────────────────────────

    function testPauseBlocksClaimAndPublish() public {
        _publishTwoLeaf(1);
        dist.pause();

        vm.prank(alice);
        vm.expectRevert("Pausable: paused");
        dist.claim(1, ALICE_REWARD, _proofForAlice());

        vm.expectRevert("Pausable: paused");
        _publishTwoLeaf(2);
    }
}
