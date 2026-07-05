"""Init the Fee-Creator claim data for one epoch.

Pipeline (read-only against junoswap): pull each creator's fee basis from the junoswap indexer
for the epoch's day window, apply the 90% reward share (dropping sub-threshold dust), build the
Merkle tree, and write the epoch's claim data JSON. That JSON is what funds/publishes the epoch
on-chain (root + total) and what the claim UI serves (per-creator amount + proof).

The reward math and Merkle encoding mirror services/marketplace/creator-fee/*.ts exactly, so a
distribution built here is interchangeable with the TS one and verifies against the same
CreatorFeeDistributor contract.

Usage:
    python -m scripts.creator_fee.settlement \\
        --indexer-url https://indexer.junoswap.trade \\
        --chain-id 96 --epoch-id 1 --from-day 1751500800 --to-day 1752105600 \\
        --out data/creator-fee/epoch-1.json
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from dataclasses import dataclass

try:
    from .merkle import build_tree
except ImportError:  # allow running as a plain script from this directory
    from merkle import build_tree

REWARD_BPS = 9000  # 90% of the fee each creator's tokens generated
MIN_REWARD_WEI = 10**18  # 1 KKUB — creators below this are dropped from the tree


@dataclass
class Reward:
    creator: str
    amount: int  # payout-token (KKUB) wei


def fetch_creator_fees(indexer_url: str, chain_id: int, from_day: int, to_day: int) -> list[dict]:
    url = (
        f"{indexer_url.rstrip('/')}/campaign/creator-fees"
        f"?chainId={chain_id}&fromDay={from_day}&toDay={to_day}"
    )
    req = urllib.request.Request(url, headers={"accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 (trusted internal URL)
        if resp.status != 200:
            raise RuntimeError(f"indexer /campaign/creator-fees failed: {resp.status}")
        body = json.loads(resp.read())
    return body.get("creators", []) or []


def compute_rewards(
    rows: list[dict], reward_bps: int = REWARD_BPS, min_reward_wei: int = MIN_REWARD_WEI
) -> list[Reward]:
    """Aggregate fees by creator (lowercased), apply the reward share, drop dust, sort."""
    fee_by_creator: dict[str, int] = {}
    for row in rows:
        creator = (row.get("creator") or "").lower()
        if not creator:
            continue
        fee = int(row.get("feeNative") or 0)
        if fee <= 0:
            continue
        fee_by_creator[creator] = fee_by_creator.get(creator, 0) + fee

    rewards = [
        Reward(creator, (fee * reward_bps) // 10_000)
        for creator, fee in fee_by_creator.items()
    ]
    rewards = [r for r in rewards if r.amount >= min_reward_wei]
    rewards.sort(key=lambda r: r.creator)
    return rewards


def build_epoch_claim_data(
    epoch_id: int, chain_id: int, from_day: int, to_day: int, rewards: list[Reward]
) -> dict:
    """Assemble the epoch's claim-data document: root + fund total + per-creator proofs."""
    root, proofs = build_tree([(r.creator, r.amount) for r in rewards])
    total = sum(r.amount for r in rewards)
    return {
        "epochId": epoch_id,
        "chainId": chain_id,
        "fromDay": from_day,
        "toDay": to_day,
        "rewardBps": REWARD_BPS,
        "root": root,
        "total": str(total),  # wei as string — JSON has no bigint
        "claims": [
            {"creator": r.creator, "amount": str(r.amount), "proof": proofs[r.creator]}
            for r in rewards
        ],
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Init Fee-Creator claim data for one epoch")
    p.add_argument("--indexer-url", required=True)
    p.add_argument("--chain-id", type=int, required=True)
    p.add_argument("--epoch-id", type=int, required=True)
    p.add_argument("--from-day", type=int, required=True, help="epoch start, UTC-day-aligned unix seconds")
    p.add_argument("--to-day", type=int, required=True, help="epoch end (exclusive)")
    p.add_argument("--out", required=True, help="output JSON path")
    args = p.parse_args(argv)

    rows = fetch_creator_fees(args.indexer_url, args.chain_id, args.from_day, args.to_day)
    rewards = compute_rewards(rows)
    if not rewards:
        print("No creator cleared the payout floor — nothing to publish for this epoch.", file=sys.stderr)
        return 1

    doc = build_epoch_claim_data(args.epoch_id, args.chain_id, args.from_day, args.to_day, rewards)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)

    print(f"epoch {args.epoch_id}: {len(rewards)} creators, fund {doc['total']} wei KKUB")
    print(f"root {doc['root']}")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
