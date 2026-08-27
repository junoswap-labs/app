// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {PermissionRegistry} from "./PermissionRegistry.sol";

/// @title JunoPts — KAP-22-style loyalty points token
/// @notice Best-effort mirror of Bitkub Chain's KAP-22 "loyalty points, built on KAP-20, with
///         periods and token expiration" standard, adapted for this project. The exact real
///         KAP-22 Solidity interface could not be confirmed from public docs at the time this was
///         written (see docs/Marketplace_Redeem_Feature.md) — re-validate function signatures
///         against the real interface (via the kub-docs MCP) before mainnet deploy.
/// @dev Ordinary `transfer`/`transferFrom` require AT LEAST ONE side — sender or recipient — to
///      hold PermissionRegistry's AUTHORIZE_ROLE (the project's own "Registered" concept, not
///      Bitkub's IKYCBitkubChain, see PermissionRegistry.sol's header comment on why). That is the
///      property the token exists for: points can always move between a holder and a Registered
///      counterparty (a merchant, an escrow, the platform), but two unregistered wallets can never
///      trade points with each other, so no secondary market can form.
///      Consequences worth knowing before granting anything:
///      - Every contract that custodies points — RwaEscrow, RedeemNftSettlement, any future escrow
///        — must itself hold AUTHORIZE_ROLE, otherwise an unregistered buyer cannot pay into it.
///      - A TRANSFER_ROUTER_ROLE holder bypasses the check entirely, so it can move points between
///        two unregistered addresses (an escrow releasing to a merchant treasury). Grant it only to
///        contracts, never to an EOA: it is a blanket exemption, not a narrowed one.
/// @dev Period/expiration bookkeeping (`_periodBalance`) records which period tokens were minted
///      into, for a future expiry-sweep feature — it is intentionally NOT touched by ordinary
///      transfers (only by mint/burn/*CustomPeriod calls), so it reflects issuance history, not
///      live per-account custody, once tokens move between accounts. `advancePeriod` exists so the
///      storage layout doesn't need to change when real expiry sweeping is implemented, but no
///      such sweep exists yet — treat multi-period support as a scaffold, not a finished feature.
contract JunoPts is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TRANSFER_ROUTER_ROLE = keccak256("TRANSFER_ROUTER_ROLE");

    /// @notice Fraud-recovery role, mirroring KAP-20/22's "Committee" concept (adminTransfer /
    ///         adminApprove) — each token dev decides whether/how to use it; kept minimal here.
    bytes32 public constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");

    PermissionRegistry public immutable registry;

    uint256 public currentPeriod; // 0 = the initial period; periods never expire until periodDuration[p] is set
    mapping(uint256 => uint256) public periodDuration; // 0 = never expires
    mapping(address => mapping(uint256 => uint256)) private _periodBalance;

    event PeriodAdvanced(uint256 indexed newPeriod, uint256 duration);
    event MintedToPeriod(address indexed to, uint256 indexed period, uint256 amount);
    event BurnedFromPeriod(address indexed from, uint256 indexed period, uint256 amount);
    event AdminTransfer(address indexed from, address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        address _registry,
        address committee,
        address admin
    ) ERC20(name_, symbol_) {
        require(
            _registry != address(0) && committee != address(0) && admin != address(0),
            "zero address"
        );
        registry = PermissionRegistry(_registry);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMMITTEE_ROLE, committee);
    }

    // ---- Minting ----

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mintToPeriod(to, currentPeriod, amount);
    }

    function mintCurrentPeriod(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mintToPeriod(to, currentPeriod, amount);
    }

    function mintCustomPeriod(address to, uint256 period, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        require(period <= currentPeriod, "future period");
        _mintToPeriod(to, period, amount);
    }

    function _mintToPeriod(address to, uint256 period, uint256 amount) private {
        _periodBalance[to][period] += amount;
        _mint(to, amount);
        emit MintedToPeriod(to, period, amount);
    }

    // ---- Burning ----

    function burn(uint256 amount) external {
        _burnFromPeriod(msg.sender, currentPeriod, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burnFromPeriod(account, currentPeriod, amount);
    }

    function burnCustomPeriod(address account, uint256 period, uint256 amount) external {
        if (account != msg.sender) _spendAllowance(account, msg.sender, amount);
        _burnFromPeriod(account, period, amount);
    }

    function _burnFromPeriod(address account, uint256 period, uint256 amount) private {
        require(_periodBalance[account][period] >= amount, "insufficient period balance");
        _periodBalance[account][period] -= amount;
        _burn(account, amount);
        emit BurnedFromPeriod(account, period, amount);
    }

    // ---- Period-aware views ----

    function balanceOfPeriod(address account, uint256 period) external view returns (uint256) {
        return _periodBalance[account][period];
    }

    /// @notice Total ever-minted-and-not-yet-burned-by-period-call balance — see the contract's
    ///         header comment on why this can diverge from `balanceOf` once ordinary transfers move
    ///         tokens between accounts. Provided for KAP-22 interface parity.
    function balanceOfAll(address account) external view returns (uint256) {
        return balanceOf(account);
    }

    function balanceOfExpired(address /* account */ ) external pure returns (uint256) {
        return 0; // no expiry sweep implemented yet — see contract header comment
    }

    function currentIndex() external view returns (uint256) {
        return currentPeriod;
    }

    function readPeriodTimestamp(uint256 period) external view returns (uint256) {
        return periodDuration[period];
    }

    // ---- Period management (scaffold only, see header comment) ----

    function setPeriodTimeStamp(uint256 period, uint256 duration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(period <= currentPeriod, "unknown period");
        periodDuration[period] = duration;
    }

    function advancePeriod(uint256 duration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        currentPeriod += 1;
        periodDuration[currentPeriod] = duration;
        emit PeriodAdvanced(currentPeriod, duration);
    }

    // ---- KAP-22 gated transfer (interface parity with internalTransfer/externalTransfer) ----

    function internalTransfer(address from, address to, uint256 amount)
        external
        onlyRole(TRANSFER_ROUTER_ROLE)
        whenNotPaused
    {
        _requireAuthorizedParty(from, to);
        _transfer(from, to, amount);
    }

    function externalTransfer(address from, address to, uint256 amount)
        external
        onlyRole(TRANSFER_ROUTER_ROLE)
        whenNotPaused
    {
        require(registry.isAuthorized(from), "sender must be authorized");
        _transfer(from, to, amount);
    }

    /// @notice Fraud recovery — Committee-only, per KAP-20/22's adminTransfer convention. Bypasses
    ///         the registry check entirely (moving funds out of a compromised/malicious account is
    ///         the whole point). Each deployment decides how aggressively to use this; the role can
    ///         be renounced/left ungranted if it's not wanted for this instance.
    function adminTransfer(address from, address to, uint256 amount) external onlyRole(COMMITTEE_ROLE) {
        _transfer(from, to, amount);
        emit AdminTransfer(from, to, amount);
    }

    function adminApprove(address owner, address spender, uint256 amount) external onlyRole(COMMITTEE_ROLE) {
        _approve(owner, spender, amount);
    }

    // ---- Standard ERC20 transfer/transferFrom gating ----

    /// @dev The whole transfer restriction, in one place. Either side being Registered is enough:
    ///      an unregistered holder can always pay a merchant or an escrow, and a merchant or escrow
    ///      can always pay them back — what stays impossible is two unregistered wallets moving
    ///      points between themselves.
    function _requireAuthorizedParty(address from, address to) private view {
        require(registry.isAuthorized(from) || registry.isAuthorized(to), "sender or recipient must be authorized");
    }

    function _beforeTokenTransfer(address from, address to, uint256 /* amount */ ) internal view override {
        if (from == address(0) || to == address(0)) return; // mint/burn — not a transfer, not paused-gated
        if (hasRole(COMMITTEE_ROLE, _msgSender())) return; // fraud recovery bypasses gating entirely, incl. pause
        require(!paused(), "Pausable: paused");
        // A router is a trusted contract moving points on the protocol's behalf (escrow release,
        // settlement payout), where neither endpoint need be Registered.
        if (hasRole(TRANSFER_ROUTER_ROLE, _msgSender())) return;
        _requireAuthorizedParty(from, to);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
