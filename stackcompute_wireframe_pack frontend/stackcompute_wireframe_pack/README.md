# StackCompute – Clickable Wireframe Pack

This folder contains a static prototype (no blockchain calls) meant to guide the 24‑hour implementation.

## Files
- `index.html` – clickable wireframe with all screens
- `contracts/stackcompute.clar` – Clarity contract skeleton
- `contracts/trophy-nft.clar` – Trophy/NFT SBT skeleton
- `verifier/sample_verifier.py` – off‑chain sample verifier sketch
- `data/sample_job.json` – example job metadata

## How to use
Open `index.html` in a browser. Click through roles (Organizer, Worker, Judge) and use the buttons to simulate actions. Use this as a blueprint while building the real app on Stacks testnet.

## Demo sequence (5 minutes)
1. **Organizer creates & funds job** (tab “Organizer – Create Job” → “Create & Deploy” → “Deposit”).  
2. **Worker registers & stakes** (tab “Worker – Register & Stake”).  
3. **Worker commits** a result (tab “Worker – Commit Result”).  
4. **Organizer reveals seed** (tab “Organizer – Job Dashboard” → “Reveal Seed”).  
5. **Worker reveals samples** (tab “Worker – Reveal Samples”).  
6. **(Optional) Judge attests** pass/fail (tab “Judge/Attestor Panel”).  
7. **Settle & Pay** (tab “Organizer – Job Dashboard” → “Settle & Pay”).  
8. **Public page + Big‑screen mode** show payouts and fake tx links.

## 24-hour plan (3-person team)
- **Dev A (Clarity):** escrow, register, commit, reveal, settle; post‑conditions; events.  
- **Dev B (Frontend):** wallet connect, organizer + worker screens, explorer links.  
- **Dev C (Verifier/Glue):** Merkle tool, sample selection, CSV import, public scoreboard.

Deliver a *live* payout on testnet during the demo.
