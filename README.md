Below is a complete `README.md` you can drop at the repo root. It reflects the **autopay** design, **Merkle proof** format, **challenge index derivation**, Leather integration, and a 24-hour build/run workflow.

---

# StackCompute — Verifiable Compute Bounties on Stacks

**StackCompute** is a marketplace-style dapp where renters post compute jobs, providers commit results, and the **first valid claim** auto-pays from on-chain escrow. Verification uses a **commit → reveal → sampled proof** flow with **Merkle branches**. Winners receive a **non-transferable Trophy SBT**.

 **Autopay in one tx:** verification + payout + SBT mint inside `claim`
 **Deterministic fairness:** commit-reveal seed → contract derives challenge indices
 **Stacks-native logic:** Clarity rules + **post-conditions** cap outflows
 **Live demo friendly:** in-browser compute for a deterministic task (no GPUs needed)

---

## TL;DR (demo)

1. Renter **creates** job (with seed hash) and **funds** escrow.
2. Provider **registers & stakes**, **computes** locally, **commits** Merkle root.
3. Renter **reveals seed**.
4. Provider **claims** with sample proofs → **contract verifies & pays** in that tx → **Trophy SBT** minted.
5. TV page shows winners, payout & SBT tx links (confetti 🎉).

---

## Architecture

```mermaid
flowchart LR
  subgraph Client App (Next.js)
    UI[Marketplace + Consoles + TV] --> SC[Stacks Connect (Leather)]
    UI --> Sampler[sampler.ts (derive challenge indices)]
    UI --> Merkle[merkle.ts (root + proofs)]
  end

  SC --> CL[Stacks Network (testnet)]
  CL --> JR[(job-registry.clar)]
  CL --> SBT[(trophy-sbt.clar)]

  subgraph Off-chain Compute (Provider)
    D[data/sample_inputs.json]
    P[Deterministic compute in browser/CLI]
    P --> Merkle
  end

  D --> P
  P --> UI
```

**On-chain:** money, roles, commits, seed reveal, **claim verification & payout**, SBT mint, finalize backstop.
**Off-chain:** compute outputs, Merkle tree & branches (proofs passed to `claim`).

---

## Repo Structure

```
stackcompute/
├─ contracts/
│  ├─ job-registry.clar          # escrow, register, commit, reveal, claim(autopay), finalize, getters
│  └─ trophy-sbt.clar            # non-transferable trophy NFT (SBT)
├─ app/
│  ├─ pages/
│  │  ├─ index.tsx               # role chooser
│  │  ├─ marketplace/index.tsx   # public listings
│  │  ├─ marketplace/[jobId].tsx # job details (register/stake → provider console)
│  │  ├─ renter/create.tsx       # create & fund (+ seed hash, autopay ON)
│  │  ├─ renter/[jobId].tsx      # reveal seed, finalize fallback
│  │  ├─ provider/[jobId].tsx    # compute, commit, claim
│  │  ├─ attestor/[jobId].tsx    # fallback pass/fail (autopays)
│  │  ├─ job/[jobId].tsx         # read-only status, tx links
│  │  └─ tv/[jobId].tsx          # big-screen leaderboard
│  ├─ components/…               # LeatherConnect, JobCard, TxChip, StatusBadge, PayoutTable
│  ├─ lib/                       # stacks.ts (calls + post-conditions), abi.ts, explorer.ts
│  ├─ utils/                     # sampler.ts (indices), merkle.ts (root + proofs)
│  └─ styles/globals.css
├─ schemas/meta.schema.json      # marketplace meta-uri schema
├─ examples/meta.sample.json     # example listing JSON
├─ data/sample_inputs.json       # 100-item demo dataset
├─ scripts/provider-cli.ts       # optional local CLI to build predictions/proofs
└─ README.md
```

---

## Contracts

### `job-registry.clar`

* `create-job(budget u, min-stake u, commit-until u, reveal-until u, inputs-len u, seed-hash (buff 32), meta-uri (string-ascii 256), is-public bool, autopay bool, settler-reward u) -> (ok uint)`
* `fund(jobId u, amount u) -> (ok true)` **(escrow deposits)**
* `register-worker(jobId u) -> (ok true)` **(stake locks)**
* `commit-result(jobId u, result-root (buff 32)) -> (ok true)`
* `reveal-seed(jobId u, secret (buff 32)) -> (ok true)` **(checks sha256(secret)==seed-hash)**
* `claim(jobId u, samples (list 10 { idx (buff 4), label uint, branch (list 16 { dir bool, hash (buff 32) }) })) -> (ok true)`
  **Autopay:** verifies samples against committed root **and** deterministic label function; transfers payout to `tx-sender`, refunds stake, mints SBT, marks settled.
* `attest-valid(jobId u, worker principal, payout u) -> (ok true)` **(fallback; also autopays)**
* `finalize(jobId u) -> (ok true)` **(after window, refund escrow/stakes; optional settler reward)**

**Read-only views**

* `get-next-job-id() -> uint`
* `get-job(jobId u) -> {...}`
* `get-worker(jobId u, who principal) -> {...}`

### `trophy-sbt.clar`

* `mint(jobId u, to principal) -> (ok true)` (non-transferable)

---

## Verification Details

* **Deterministic demo task:**
  `label[i] = sha256(seed || i) mod 10` for `i=0..N-1` with `N=inputs-len` (100 in demo)

* **Challenge indices (on-chain & off-chain):**
  `idx_k = sha256(seed || jobId || k) mod N` for `k=0..K-1` (K=10)

* **Merkle hashing (must match UI & contract):**

  * **Leaf:** `sha256(0x00 || idx[4] || label[1])`
  * **Inner:** `sha256(0x01 || left || right)`
    (Proof nodes carry a `dir` bit to place sibling left/right.)

* **First valid claim wins.** (Tie-break optional; MVP uses “first to pass”.)

---

## Prerequisites

* Node 18+ and **pnpm** or **yarn**
* **Clarinet** installed for contract checks/tests
* **Leather** wallet on **Stacks Testnet** with faucet STX

---

## Setup

```bash
# install deps
pnpm install

# contract static analysis
clarinet check
```

Create `.env.local` in `app/`:

```bash
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_REGISTRY_ADDRESS=SPXXXX.job-registry-v1a
NEXT_PUBLIC_SBT_ADDRESS=SPXXXX.trophy-sbt-v1a
NEXT_PUBLIC_EXPLORER_BASE=https://explorer.stacks.co
```

---

## Deploy (recommended via Explorer + Leather)

1. Deploy **trophy-sbt** (Testnet, High fee, fresh name).
2. Deploy **job-registry** (Testnet, High fee, fresh name).
3. Record both principals; update `.env.local`.

> If deploy fails, see **Troubleshooting** below.

---

## Run the dapp

```bash
pnpm --filter app dev
# open http://localhost:3000
```

---

## User Journeys

### Renter (job creator)

1. **Create Job:** fill form, click **Generate Secret** → seed hash shown → **Create Job** (tx).
2. **Fund:** **Deposit** STX (tx).
3. **Reveal:** When ready, **Reveal Seed** (tx).
4. Autopay handles payout upon valid claim. If no claims by `reveal-until`, call **Finalize** (tx).

### Provider (worker)

1. **Marketplace:** Pick a job; **Register & Stake** (tx).
2. **Compute & Commit:** Click **Generate Predictions** (browser) → shows Merkle root → **Commit Result** (tx).
3. **Claim:** After seed reveal, page shows 10 indices. Build `{idx,label,branch[]}` and click **Claim Payout** (tx).
   In the same tx: **payout + SBT mint**.

### Attestor (fallback)

* `/attestor/[jobId]`: **Pass** a provider to autopay if proof UX hiccups.

### Public & TV

* `/job/[jobId]`: live status, explorer links.
* `/tv/[jobId]`: big-screen leaderboard; confetti on `settled`.

---

## Flow

1. Open **Marketplace** → open listing.
2. Provider: **Register & Stake** → **Open Provider Console**.
3. **Generate Predictions** → **Commit Result**.
4. Renter: **Reveal Seed**.
5. Provider: **Claim Payout** → single tx shows payout & **Trophy SBT** links.
6. Switch to **TV Mode** → confetti + explorer links; call out **post-conditions** and fairness.

---

## Post-conditions (attach from UI)

* On `claim`/`finalize`: **From contract principal** transfer **≤ budget**.
* On `fund`: optional post-condition for exact deposit amount.

---

## Test Vectors

* **Merkle Root:** `0x8250c95ae1efb84fb56e24bce9260af8e526662f50d17ebc7a64fcc28068cb90`
* **Challenge Indices (K=10):** `[72, 68, 3, 42, 39, 10, 21, 43, 79, 3]`
* **Leaf/Inner formats:** as defined above.

---

## Security / Invariants

* **Autopay only in `claim`.** No separate “settle” path in happy flow.
* **First valid claim wins.** Once settled, further claims revert.
* **Deadlines enforced** using `block-height`.
* **Stake lifecycle:** locked on register; refunded on success/finalize (slash on failure optional).
* **Gas bounds:** `K=10`, `D≤16` keep proofs small.
* **Post-conditions** cap total outflow from contract.

---

## Troubleshooting Deploy (quick table)

| Symptom                   | Fix                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **ContractAlreadyExists** | Deploy under a fresh name (e.g., `…-v1a`), update `.env.local`.                                                                             |
| **Analysis/Type error**   | Run `clarinet check`; fix `buff` lengths, list sizes, or missing view funcs. Avoid hard-coding external principals—pass via storage/params. |
| **FeeTooLow / OutOfGas**  | Pick **High** fee in Explorer; larger contracts need more fee.                                                                              |
| **BadNonce / PendingTx**  | Check mempool; wait or rebroadcast with higher fee (same nonce).                                                                            |
| **InsufficientFunds**     | Refill Testnet STX for deployer.                                                                                                            |
| **Network mismatch**      | Ensure Leather **Testnet**, Explorer **Testnet**, and names match exactly.                                                                  |

---

## Scripts & Testing

* **Contract static analysis:** `clarinet check`
* **Contract tests:** (add in `/tests/`) for create → fund → register → commit → reveal → **claim**, plus guard cases.
* **Optional provider CLI:** `scripts/provider-cli.ts` to build predictions & proofs.

---

## License

MIT (or your preferred license). Add a `LICENSE` file if needed.

---
