"""OpenZeppelin StandardMerkleTree, reimplemented to match `@openzeppelin/merkle-tree`.

The proofs this produces verify against `MerkleProof.verify` in CreatorFeeDistributor.claim
(and against the TS `@openzeppelin/merkle-tree` used elsewhere in this repo). Leaf encoding is
double-keccak of abi.encode(['address','uint256'], [account, amount]); internal nodes hash the
two children commutatively (sorted before concat), exactly like OZ.
"""

from __future__ import annotations

from eth_abi import encode as abi_encode
from eth_utils import keccak

ZERO32 = b"\x00" * 32


def leaf_hash(account: str, amount: int) -> bytes:
    """Double-hashed leaf: keccak(keccak(abi.encode(address, uint256))).

    The outer hash guards against an internal proof node being reinterpreted as a leaf.
    """
    return keccak(keccak(abi_encode(["address", "uint256"], [account, amount])))


def _hash_pair(a: bytes, b: bytes) -> bytes:
    # Commutative: sort the pair so verification never needs to know left/right.
    return keccak(a + b) if a < b else keccak(b + a)


def _make_tree(leaves: list[bytes]) -> list[bytes]:
    # Flat complete-binary-tree layout identical to OZ makeMerkleTree: leaf i sits at
    # index (len-1-i), parents fill down to the root at index 0.
    n = len(leaves)
    if n == 0:
        raise ValueError("cannot build a tree with no leaves")
    tree = [ZERO32] * (2 * n - 1)
    for i, leaf in enumerate(leaves):
        tree[len(tree) - 1 - i] = leaf
    for i in range(len(tree) - 1 - n, -1, -1):
        tree[i] = _hash_pair(tree[2 * i + 1], tree[2 * i + 2])
    return tree


def _get_proof(tree: list[bytes], tree_index: int) -> list[bytes]:
    proof: list[bytes] = []
    j = tree_index
    while j > 0:
        sibling = j - 1 if j % 2 == 0 else j + 1
        proof.append(tree[sibling])
        j = (j - 1) >> 1  # parent
    return proof


def build_tree(entries: list[tuple[str, int]]) -> tuple[str, dict[str, list[str]]]:
    """Build the tree over (account, amount) pairs.

    Returns (root, proofs) where root is a 0x-hex string and proofs maps each *lowercased*
    account to its 0x-hex proof node list. Mirrors StandardMerkleTree.of: leaves are sorted
    by hash before the tree is built, and the value->leaf index mapping is preserved so each
    account's proof is correct.
    """
    if not entries:
        raise ValueError("cannot build a distribution with no entries")

    hashed = sorted(
        ((account, leaf_hash(account, amount)) for account, amount in entries),
        key=lambda x: x[1],
    )
    tree = _make_tree([h for _, h in hashed])

    proofs: dict[str, list[str]] = {}
    for sorted_pos, (account, _) in enumerate(hashed):
        tree_index = len(tree) - 1 - sorted_pos
        proofs[account.lower()] = [
            "0x" + node.hex() for node in _get_proof(tree, tree_index)
        ]

    return "0x" + tree[0].hex(), proofs
