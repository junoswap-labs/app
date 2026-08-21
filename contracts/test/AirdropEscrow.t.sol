// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {AirdropEscrow} from "../src/AirdropEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract AirdropEscrowTest is Test {
    AirdropEscrow internal escrow;
    MockERC20 internal token;

    address internal admin = address(0xAD31);
    address internal relayer = address(0x6E1A7);
    address internal feeCollector = address(0xFEE);
    address internal creator = address(0xC6EA70);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    uint256 internal signerPk = 0xBEEF5162;
    address internal signer;

    bytes32 internal constant CAMPAIGN = keccak256("campaign-1");

    function setUp() public {
        signer = vm.addr(signerPk);
        escrow = new AirdropEscrow(0, feeCollector, admin, relayer, signer);
        token = new MockERC20();

        token.mint(creator, 1_000_000 ether);
        vm.prank(creator);
        token.approve(address(escrow), type(uint256).max);
    }

    function _signClaim(uint256 pk, bytes32 campaignId, address recipient, uint256 amount, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = escrow.claimAuthorizationDigest(campaignId, recipient, amount, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _claimSelfAs(uint256 pk, bytes32 campaignId, address recipient, uint256 amount, uint256 deadline)
        internal
    {
        bytes memory sig = _signClaim(pk, campaignId, recipient, amount, deadline);
        vm.prank(recipient);
        escrow.claim(campaignId, recipient, amount, deadline, sig);
    }

    function _claimSelf(bytes32 campaignId, address recipient, uint256 amount) internal {
        _claimSelfAs(signerPk, campaignId, recipient, amount, block.timestamp + 1 hours);
    }

    function _campaignStatus(bytes32 id) internal view returns (AirdropEscrow.CampaignStatus) {
        return escrow.getCampaign(id).status;
    }

    function _remaining(bytes32 id) internal view returns (uint256) {
        return escrow.getCampaign(id).remainingAmount;
    }

    function _claimedCount(bytes32 id) internal view returns (uint32) {
        return escrow.getCampaign(id).claimedCount;
    }

    function _gasDepositAndSpent(bytes32 id) internal view returns (uint256 gasDeposit, uint256 gasSpent) {
        AirdropEscrow.Campaign memory c = escrow.getCampaign(id);
        return (c.gasDeposit, c.gasSpent);
    }

    function _createFixed(bytes32 id, uint256 fixedAmount, uint256 total, uint32 maxClaimants, uint256 expiresAt)
        internal
    {
        vm.prank(creator);
        escrow.createCampaign(
            AirdropEscrow.CreateCampaignParams({
                campaignId: id,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Fixed,
                fixedAmount: fixedAmount,
                minAmount: 0,
                maxAmount: 0,
                totalAmount: total,
                maxClaimants: maxClaimants,
                expiresAt: expiresAt,
                gasMode: AirdropEscrow.GasMode.Self,
                gasDeposit: 0
            })
        );
    }

    function _createRandom(
        bytes32 id,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 total,
        uint32 maxClaimants,
        uint256 expiresAt
    ) internal {
        vm.prank(creator);
        escrow.createCampaign(
            AirdropEscrow.CreateCampaignParams({
                campaignId: id,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Random,
                fixedAmount: 0,
                minAmount: minAmount,
                maxAmount: maxAmount,
                totalAmount: total,
                maxClaimants: maxClaimants,
                expiresAt: expiresAt,
                gasMode: AirdropEscrow.GasMode.Self,
                gasDeposit: 0
            })
        );
    }

    function _createFixedRelayer(
        bytes32 id,
        uint256 fixedAmount,
        uint256 total,
        uint32 maxClaimants,
        uint256 expiresAt,
        uint256 gasDeposit
    ) internal {
        vm.deal(creator, gasDeposit);
        vm.prank(creator);
        escrow.createCampaign{value: gasDeposit}(
            AirdropEscrow.CreateCampaignParams({
                campaignId: id,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Fixed,
                fixedAmount: fixedAmount,
                minAmount: 0,
                maxAmount: 0,
                totalAmount: total,
                maxClaimants: maxClaimants,
                expiresAt: expiresAt,
                gasMode: AirdropEscrow.GasMode.Relayer,
                gasDeposit: gasDeposit
            })
        );
    }

    function _createRandomRelayer(
        bytes32 id,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 total,
        uint32 maxClaimants,
        uint256 expiresAt,
        uint256 gasDeposit
    ) internal {
        vm.deal(creator, gasDeposit);
        vm.prank(creator);
        escrow.createCampaign{value: gasDeposit}(
            AirdropEscrow.CreateCampaignParams({
                campaignId: id,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Random,
                fixedAmount: 0,
                minAmount: minAmount,
                maxAmount: maxAmount,
                totalAmount: total,
                maxClaimants: maxClaimants,
                expiresAt: expiresAt,
                gasMode: AirdropEscrow.GasMode.Relayer,
                gasDeposit: gasDeposit
            })
        );
    }

    // ---------------------------------------------------------------------
    // createCampaign
    // ---------------------------------------------------------------------

    function testCreateFixedCampaignPullsTokens() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        assertEq(token.balanceOf(address(escrow)), 100 ether, "vault holds deposit");
        assertEq(token.balanceOf(creator), 1_000_000 ether - 100 ether);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Active));
    }

    function testCreateCampaignIdAlreadyUsedReverts() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        vm.expectRevert("campaign id already used");
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
    }

    function testCreateRandomInfeasibleMaxClaimantsReverts() public {
        // 10 slots at min 10 ether each needs 100 ether; only depositing 50 ether.
        vm.expectRevert("totalAmount cannot cover maxClaimants at minAmount");
        _createRandom(CAMPAIGN, 10 ether, 20 ether, 50 ether, 10, 0);
    }

    function testCreateCampaignWrongFeeReverts() public {
        AirdropEscrow feeEscrow = new AirdropEscrow(1 ether, feeCollector, admin, relayer, signer);
        vm.deal(creator, 2 ether);
        vm.prank(creator);
        token.approve(address(feeEscrow), type(uint256).max);
        vm.prank(creator);
        vm.expectRevert("incorrect creation fee");
        feeEscrow.createCampaign{value: 0.5 ether}(
            AirdropEscrow.CreateCampaignParams({
                campaignId: CAMPAIGN,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Fixed,
                fixedAmount: 10 ether,
                minAmount: 0,
                maxAmount: 0,
                totalAmount: 100 ether,
                maxClaimants: 10,
                expiresAt: 0,
                gasMode: AirdropEscrow.GasMode.Self,
                gasDeposit: 0
            })
        );
    }

    function testCreateCampaignChargesFlatFeeToCollector() public {
        AirdropEscrow feeEscrow = new AirdropEscrow(1 ether, feeCollector, admin, relayer, signer);
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        token.approve(address(feeEscrow), type(uint256).max);
        vm.prank(creator);
        feeEscrow.createCampaign{value: 1 ether}(
            AirdropEscrow.CreateCampaignParams({
                campaignId: CAMPAIGN,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Fixed,
                fixedAmount: 10 ether,
                minAmount: 0,
                maxAmount: 0,
                totalAmount: 100 ether,
                maxClaimants: 10,
                expiresAt: 0,
                gasMode: AirdropEscrow.GasMode.Self,
                gasDeposit: 0
            })
        );
        assertEq(feeCollector.balance, 1 ether, "flat fee forwarded");
    }

    // ---------------------------------------------------------------------
    // Fixed-amount claims
    // ---------------------------------------------------------------------

    function testFixedClaimSelfPay() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        _claimSelf(CAMPAIGN, alice, 10 ether);
        assertEq(token.balanceOf(alice), 10 ether);
        assertEq(_remaining(CAMPAIGN), 90 ether);
        assertEq(_claimedCount(CAMPAIGN), 1);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Active));
    }

    function testFixedClaimSameRecipientTwiceReverts() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        _claimSelf(CAMPAIGN, alice, 10 ether);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 10 ether, deadline);
        vm.prank(alice);
        vm.expectRevert("already claimed");
        escrow.claim(CAMPAIGN, alice, 10 ether, deadline, sig);
    }

    function testFixedCampaignClosesAtMaxClaimants() public {
        _createFixed(CAMPAIGN, 50 ether, 100 ether, 2, 0);
        _claimSelf(CAMPAIGN, alice, 50 ether);
        _claimSelf(CAMPAIGN, bob, 50 ether);
        assertEq(_remaining(CAMPAIGN), 0);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Closed));

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, carol, 50 ether, deadline);
        vm.prank(carol);
        vm.expectRevert("campaign not active");
        escrow.claim(CAMPAIGN, carol, 50 ether, deadline, sig);
    }

    function testFixedClaimViaRelayer() public {
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, 0, 1 ether);
        uint256 relayerBalBefore = relayer.balance;
        vm.prank(relayer);
        escrow.claimFor(CAMPAIGN, alice, 0.01 ether);
        assertEq(token.balanceOf(alice), 10 ether, "tokens land on the recipient, not the relayer");
        assertEq(token.balanceOf(relayer), 0);
        assertEq(relayer.balance, relayerBalBefore + 0.01 ether, "relayer reimbursed from the campaign's gas deposit");
    }

    function testClaimForRevertsForNonRelayer() public {
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, 0, 1 ether);
        vm.expectRevert();
        escrow.claimFor(CAMPAIGN, alice, 0);
    }

    function testClaimForRevertsForSelfModeCampaign() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        vm.prank(relayer);
        vm.expectRevert("campaign is not relayer-funded");
        escrow.claimFor(CAMPAIGN, alice, 0);
    }

    function testUnlimitedFixedCampaignClosesOnExhaustion() public {
        // 25 ether total, 10 ether fixed -> 2 claims of 10 succeed, remaining 5 < fixedAmount so
        // the 3rd claim reverts (dust is left for the creator to reclaim), not auto-closed early.
        _createFixed(CAMPAIGN, 10 ether, 25 ether, 0, 0);
        _claimSelf(CAMPAIGN, alice, 10 ether);
        _claimSelf(CAMPAIGN, bob, 10 ether);
        assertEq(_remaining(CAMPAIGN), 5 ether);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Active));

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, carol, 10 ether, deadline);
        vm.prank(carol);
        vm.expectRevert("insufficient remaining for fixed amount");
        escrow.claim(CAMPAIGN, carol, 10 ether, deadline, sig);
    }

    // ---------------------------------------------------------------------
    // Random-amount claims
    // ---------------------------------------------------------------------

    // These four tests exercise _computeRandomAmount's own on-chain generation (sum-to-total,
    // min bound, turnover) — that logic only runs behind claimFor() now, since self-pay claim()
    // requires the backend to supply and sign the amount instead. See AirdropClaim* tests below
    // for claim()'s signature/bounds-validation coverage.
    function testRandomCampaignSumsExactlyToTotalWithCap() public {
        uint32 maxClaimants = 8;
        uint256 total = 1_000 ether;
        _createRandomRelayer(CAMPAIGN, 10 ether, 300 ether, total, maxClaimants, 0, 0.01 ether);

        uint256 sum;
        for (uint256 i = 0; i < maxClaimants; i++) {
            address recipient = address(uint160(1000 + i));
            vm.prank(relayer);
            escrow.claimFor(CAMPAIGN, recipient, 0);
            sum += token.balanceOf(recipient);
        }

        assertEq(sum, total, "sum of all random claims equals the deposited total");
        assertEq(_remaining(CAMPAIGN), 0);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Closed));
    }

    function testRandomCampaignEveryClaimAtLeastMin() public {
        uint32 maxClaimants = 6;
        uint256 minAmount = 5 ether;
        _createRandomRelayer(CAMPAIGN, minAmount, 50 ether, 300 ether, maxClaimants, 0, 0.01 ether);

        for (uint256 i = 0; i < maxClaimants; i++) {
            address recipient = address(uint160(2000 + i));
            vm.roll(block.number + 1);
            vm.prank(relayer);
            escrow.claimFor(CAMPAIGN, recipient, 0);
            assertGe(token.balanceOf(recipient), minAmount, "every claimant gets at least the configured minimum");
        }
    }

    function testRandomTurnoverGivesRemainderWhenBelowTwiceMin() public {
        // min 10, max 15 ether, total exactly 15 ether: remainingAmount (15) < 2*min (20) from the
        // very first claim, so the single unlimited claimant must receive the entire pool.
        // maxClaimants=1 since the feasibility check requires total >= maxClaimants*minAmount, and
        // this campaign is only ever meant to serve a single claimant (turnover on claim #1).
        _createRandomRelayer(CAMPAIGN, 10 ether, 15 ether, 15 ether, 1, 0, 0.01 ether);
        vm.prank(relayer);
        escrow.claimFor(CAMPAIGN, alice, 0);
        assertEq(token.balanceOf(alice), 15 ether, "turnover rule hands over 100% of what's left");
        assertEq(_remaining(CAMPAIGN), 0);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Closed));
    }

    function testRandomUnlimitedContinuesUntilTurnover() public {
        // maxClaimants=20 is the max the feasibility check allows (20*5=100=total) while still
        // being generous enough that turnover (not the cap) is what closes this campaign.
        _createRandomRelayer(CAMPAIGN, 5 ether, 20 ether, 100 ether, 20, 0, 0.01 ether);
        uint256 claims = 0;
        while (_campaignStatus(CAMPAIGN) == AirdropEscrow.CampaignStatus.Active) {
            address recipient = address(uint160(3000 + claims));
            vm.roll(block.number + 1);
            vm.prank(relayer);
            escrow.claimFor(CAMPAIGN, recipient, 0);
            claims++;
            assertLt(claims, 50, "sanity bound - should close well before this many claims");
        }
        assertEq(_remaining(CAMPAIGN), 0, "unlimited random campaign always drains to exactly zero");
    }

    // ---------------------------------------------------------------------
    // Reclaim
    // ---------------------------------------------------------------------

    function testReclaimBeforeExpiryReverts() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, block.timestamp + 1 days);
        vm.prank(creator);
        vm.expectRevert("not expired yet");
        escrow.reclaim(CAMPAIGN);
    }

    function testReclaimExactlyAtExpiryReverts() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt);
        vm.warp(expiresAt); // strict > boundary, matching RwaEscrow's deadline convention
        vm.prank(creator);
        vm.expectRevert("not expired yet");
        escrow.reclaim(CAMPAIGN);
    }

    function testReclaimAfterExpiryReturnsRemainder() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt);
        _claimSelf(CAMPAIGN, alice, 10 ether); // 10 ether claimed, 90 ether left

        vm.warp(expiresAt + 1);
        vm.prank(creator);
        escrow.reclaim(CAMPAIGN);

        assertEq(token.balanceOf(creator), 1_000_000 ether - 10 ether, "creator gets back the unclaimed remainder");
        assertEq(_remaining(CAMPAIGN), 0);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Reclaimed));
    }

    function testClaimAfterExpiryReverts() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt);
        vm.warp(expiresAt + 1);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 10 ether, deadline);
        vm.prank(alice);
        vm.expectRevert("campaign expired");
        escrow.claim(CAMPAIGN, alice, 10 ether, deadline, sig);
    }

    function testReclaimByAdminAllowed() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt);
        vm.warp(expiresAt + 1);
        vm.prank(admin);
        escrow.reclaim(CAMPAIGN);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Reclaimed));
    }

    function testReclaimByStrangerReverts() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt);
        vm.warp(expiresAt + 1);
        vm.prank(alice);
        vm.expectRevert("not creator or admin");
        escrow.reclaim(CAMPAIGN);
    }

    function testReclaimTwiceReverts() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt);
        vm.warp(expiresAt + 1);
        vm.prank(creator);
        escrow.reclaim(CAMPAIGN);
        vm.prank(creator);
        vm.expectRevert("already reclaimed");
        escrow.reclaim(CAMPAIGN);
    }

    // ---------------------------------------------------------------------
    // Gas escrow (relayer mode)
    // ---------------------------------------------------------------------

    function testCreateRelayerCampaignRequiresMaxClaimants() public {
        vm.deal(creator, 1 ether);
        vm.expectRevert("relayer mode requires a maxClaimants cap");
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 0, 0, 1 ether);
    }

    function testCreateRelayerCampaignZeroDepositReverts() public {
        vm.expectRevert("zero gasDeposit");
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, 0, 0);
    }

    function testCreateSelfModeCampaignWithGasDepositReverts() public {
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        vm.expectRevert("gasDeposit only applies to relayer mode");
        escrow.createCampaign{value: 1 ether}(
            AirdropEscrow.CreateCampaignParams({
                campaignId: CAMPAIGN,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Fixed,
                fixedAmount: 10 ether,
                minAmount: 0,
                maxAmount: 0,
                totalAmount: 100 ether,
                maxClaimants: 10,
                expiresAt: 0,
                gasMode: AirdropEscrow.GasMode.Self,
                gasDeposit: 1 ether
            })
        );
    }

    function testCreateRelayerCampaignWrongMsgValueReverts() public {
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        vm.expectRevert("incorrect creation fee");
        escrow.createCampaign{value: 0.5 ether}(
            AirdropEscrow.CreateCampaignParams({
                campaignId: CAMPAIGN,
                token: address(token),
                amountMode: AirdropEscrow.AmountMode.Fixed,
                fixedAmount: 10 ether,
                minAmount: 0,
                maxAmount: 0,
                totalAmount: 100 ether,
                maxClaimants: 10,
                expiresAt: 0,
                gasMode: AirdropEscrow.GasMode.Relayer,
                gasDeposit: 1 ether
            })
        );
    }

    function testSelfPayCampaignNeverAccruesGasDeposit() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        (uint256 gasDeposit, uint256 gasSpent) = _gasDepositAndSpent(CAMPAIGN);
        assertEq(gasDeposit, 0);
        assertEq(gasSpent, 0);
    }

    function testClaimForCapsReimbursementAtRemainingDeposit() public {
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, 0, 0.01 ether);
        uint256 relayerBalBefore = relayer.balance;
        vm.prank(relayer);
        escrow.claimFor(CAMPAIGN, alice, 1 ether); // asks for far more than the 0.01 ether deposit
        assertEq(relayer.balance, relayerBalBefore + 0.01 ether, "payout capped at the campaign's remaining deposit");
        (, uint256 gasSpent) = _gasDepositAndSpent(CAMPAIGN);
        assertEq(gasSpent, 0.01 ether, "fully exhausted");
    }

    function testReclaimGasBeforeCloseOrExpiryReverts() public {
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, 0, 1 ether);
        vm.prank(creator);
        vm.expectRevert("campaign still active");
        escrow.reclaimGas(CAMPAIGN);
    }

    function testReclaimGasAfterExpiryReturnsRemainder() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt, 1 ether);
        vm.prank(relayer);
        escrow.claimFor(CAMPAIGN, alice, 0.2 ether);

        vm.warp(expiresAt + 1);
        uint256 creatorBalBefore = creator.balance;
        vm.prank(creator);
        escrow.reclaimGas(CAMPAIGN);
        assertEq(creator.balance, creatorBalBefore + 0.8 ether, "unspent deposit returned to creator");
        (, uint256 gasSpent) = _gasDepositAndSpent(CAMPAIGN);
        assertEq(gasSpent, 1 ether, "fully accounted for after reclaim");
    }

    function testReclaimGasAfterCampaignClosedByCapWithoutExpiry() public {
        _createFixedRelayer(CAMPAIGN, 50 ether, 100 ether, 2, 0, 1 ether);
        vm.prank(relayer);
        escrow.claimFor(CAMPAIGN, alice, 0.1 ether);
        vm.prank(relayer);
        escrow.claimFor(CAMPAIGN, bob, 0.1 ether);
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Closed));

        uint256 creatorBalBefore = creator.balance;
        vm.prank(creator);
        escrow.reclaimGas(CAMPAIGN);
        assertEq(creator.balance, creatorBalBefore + 0.8 ether, "no expiry needed once the campaign closed by cap");
    }

    function testReclaimGasTwiceReverts() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt, 1 ether);
        vm.warp(expiresAt + 1);
        vm.prank(creator);
        escrow.reclaimGas(CAMPAIGN);
        vm.prank(creator);
        vm.expectRevert("nothing to reclaim");
        escrow.reclaimGas(CAMPAIGN);
    }

    function testReclaimGasByStrangerReverts() public {
        uint256 expiresAt = block.timestamp + 1 days;
        _createFixedRelayer(CAMPAIGN, 10 ether, 100 ether, 10, expiresAt, 1 ether);
        vm.warp(expiresAt + 1);
        vm.prank(alice);
        vm.expectRevert("not creator or admin");
        escrow.reclaimGas(CAMPAIGN);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function testOnlyAdminCanSetCreationFee() public {
        vm.prank(alice);
        vm.expectRevert();
        escrow.setCreationFeeFlat(1 ether);
    }

    function testPausedClaimReverts() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        vm.prank(admin);
        escrow.pause();
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 10 ether, deadline);
        vm.prank(alice);
        vm.expectRevert("Pausable: paused");
        escrow.claim(CAMPAIGN, alice, 10 ether, deadline, sig);
    }

    // ---------------------------------------------------------------------
    // Claim authorization (backend-signed EIP-712)
    // ---------------------------------------------------------------------

    function testClaimExpiredAuthorizationReverts() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 10 ether, deadline);
        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert("authorization expired");
        escrow.claim(CAMPAIGN, alice, 10 ether, deadline, sig);
    }

    function testClaimWrongSignerReverts() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        uint256 strangerPk = 0xBAD5162;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(strangerPk, CAMPAIGN, alice, 10 ether, deadline);
        vm.prank(alice);
        vm.expectRevert("bad claim authorization");
        escrow.claim(CAMPAIGN, alice, 10 ether, deadline, sig);
    }

    function testClaimFixedAmountMismatchReverts() public {
        _createFixed(CAMPAIGN, 10 ether, 100 ether, 10, 0);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 9 ether, deadline);
        vm.prank(alice);
        vm.expectRevert("amount does not match fixedAmount");
        escrow.claim(CAMPAIGN, alice, 9 ether, deadline, sig);
    }

    function testClaimRandomAmountAboveMaxReverts() public {
        _createRandom(CAMPAIGN, 10 ether, 20 ether, 100 ether, 5, 0);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 21 ether, deadline);
        vm.prank(alice);
        vm.expectRevert();
        escrow.claim(CAMPAIGN, alice, 21 ether, deadline, sig);
    }

    function testClaimRandomAmountBelowMinReverts() public {
        _createRandom(CAMPAIGN, 10 ether, 20 ether, 100 ether, 5, 0);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 5 ether, deadline);
        vm.prank(alice);
        vm.expectRevert();
        escrow.claim(CAMPAIGN, alice, 5 ether, deadline, sig);
    }

    function testClaimRandomTurnoverRequiresExactRemainder() public {
        // min 10, max 15, total 15: remainingAmount (15) < 2*min (20) immediately, so any amount
        // other than the full 15 ether remainder must be rejected.
        _createRandom(CAMPAIGN, 10 ether, 15 ether, 15 ether, 0, 0);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signClaim(signerPk, CAMPAIGN, alice, 12 ether, deadline);
        vm.prank(alice);
        vm.expectRevert();
        escrow.claim(CAMPAIGN, alice, 12 ether, deadline, sig);

        _claimSelf(CAMPAIGN, alice, 15 ether);
        assertEq(token.balanceOf(alice), 15 ether, "exact remainder accepted");
        assertEq(uint256(_campaignStatus(CAMPAIGN)), uint256(AirdropEscrow.CampaignStatus.Closed));
    }

    function testClaimRandomValidAmountWithinBoundsSucceeds() public {
        _createRandom(CAMPAIGN, 10 ether, 20 ether, 100 ether, 5, 0);
        _claimSelf(CAMPAIGN, alice, 15 ether);
        assertEq(token.balanceOf(alice), 15 ether);
        assertEq(_remaining(CAMPAIGN), 85 ether);
        assertEq(_claimedCount(CAMPAIGN), 1);
    }
}
