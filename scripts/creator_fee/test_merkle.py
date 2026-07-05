"""Cross-implementation checks for the Python settlement pipeline.

The golden root/proof were produced by `@openzeppelin/merkle-tree` (the TS lib the frontend and
contract tests use). Matching them proves the Python tree is byte-identical, so proofs built here
verify against the same on-chain CreatorFeeDistributor.

Run:  python test_merkle.py       (from this directory)
  or: python -m pytest scripts/creator_fee/test_merkle.py   (from the repo root)
"""

try:
    from .merkle import build_tree, leaf_hash
    from .settlement import build_epoch_claim_data, compute_rewards, Reward
except ImportError:
    from merkle import build_tree, leaf_hash
    from settlement import build_epoch_claim_data, compute_rewards, Reward

A = "0x1111111111111111111111111111111111111111"
B = "0x2222222222222222222222222222222222222222"
C = "0x3333333333333333333333333333333333333333"
E18 = 10**18

# Golden values from @openzeppelin/merkle-tree for
# [[A, 40e18], [B, 60e18], [C, 10e18]] with encoding ['address','uint256'].
GOLDEN_ROOT = "0x9d380f1a6a3857edc49de73c2116c191e4ecd78ab297fc68ff1b84bf74a2a8c4"
GOLDEN_PROOF_A = [
    "0x06f293a84cde0651d1fa5575451d9290b991fc0d70784c6178fff27c60a7edc4",
    "0xe004f0b11cc1df23b0dfa4896bbfc69bd76efadd1f4c3236f188a3c1d65d726f",
]


def test_root_and_proof_match_oz():
    root, proofs = build_tree([(A, 40 * E18), (B, 60 * E18), (C, 10 * E18)])
    assert root == GOLDEN_ROOT, root
    assert proofs[A] == GOLDEN_PROOF_A, proofs[A]


def test_single_leaf_root_is_leaf_and_empty_proof():
    root, proofs = build_tree([(A, 5 * E18)])
    assert root == "0x" + leaf_hash(A, 5 * E18).hex()
    assert proofs[A] == []


def test_compute_rewards_applies_90pct_and_dust_floor():
    rows = [
        {"creator": A, "feeNative": str(2 * E18)},  # -> 1.8 KKUB, kept
        {"creator": B, "feeNative": str(E18)},  # -> 0.9 KKUB, dropped
    ]
    rewards = compute_rewards(rows)
    assert rewards == [Reward(A, (2 * E18 * 9000) // 10_000)]


def test_compute_rewards_aggregates_duplicates_case_insensitively():
    rows = [
        {"creator": A.upper(), "feeNative": str(E18)},
        {"creator": A, "feeNative": str(E18)},
    ]
    rewards = compute_rewards(rows)
    assert rewards == [Reward(A, (2 * E18 * 9000) // 10_000)]


def test_build_epoch_claim_data_shape():
    rewards = compute_rewards(
        [
            {"creator": A, "feeNative": str(5 * E18)},
            {"creator": B, "feeNative": str(5 * E18)},
        ]
    )
    doc = build_epoch_claim_data(1, 96, 0, 86_400, rewards)
    assert doc["root"].startswith("0x") and len(doc["root"]) == 66
    assert doc["total"] == str(2 * (5 * E18 * 9000) // 10_000)
    assert {c["creator"] for c in doc["claims"]} == {A, B}
    for c in doc["claims"]:
        assert isinstance(c["amount"], str)
        assert isinstance(c["proof"], list)


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"OK  {fn.__name__}")
    print(f"\n{len(fns)} passed")
