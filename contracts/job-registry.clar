;; job-registry.clar - Core StackCompute job lifecycle contract (cleaned)

;; -----------------------------
;; Constants
;; -----------------------------
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-JOB-NOT-FOUND (err u101))
(define-constant ERR-ALREADY-EXISTS (err u102))
(define-constant ERR-INSUFFICIENT-FUNDS (err u103))
(define-constant ERR-DEADLINE-PASSED (err u104))
(define-constant ERR-INVALID-SEED (err u105))
(define-constant ERR-ALREADY-SETTLED (err u106))
(define-constant ERR-NOT-REVEALED (err u107))
(define-constant ERR-INVALID-PROOF (err u108))
(define-constant ERR-ALREADY-CLAIMED (err u109))
(define-constant ERR-NO-ESCROW (err u110))
(define-constant ERR-ZERO-INPUTS (err u111))

;; -----------------------------
;; Data variables
;; -----------------------------
(define-data-var next-job-id uint u1)
(define-data-var trophy-contract (optional principal) none)

;; -----------------------------
;; Maps
;; -----------------------------
(define-map jobs uint {
  organizer: principal,
  budget: uint,
  min-stake: uint,
  commit-until: uint,
  reveal-until: uint,
  inputs-len: uint,
  seed-hash: (buff 32),
  seed: (optional (buff 32)),
  meta-uri: (string-ascii 256),
  is-public: bool,
  autopay: bool,
  settler-reward: uint,
  escrow: uint,
  settled: bool
})

(define-map workers {job-id: uint, worker: principal} {
  staked: uint,
  result-root: (optional (buff 32)),
  commit-height: (optional uint),
  claimed: bool
})

;; per-principal total staked (for convenience)
(define-map stakes principal uint)

;; -----------------------------
;; Public functions
;; -----------------------------

(define-public (create-job 
  (budget uint)
  (min-stake uint)
  (commit-until uint)
  (reveal-until uint)
  (inputs-len uint)
  (seed-hash (buff 32))
  (meta-uri (string-ascii 256))
  (is-public bool)
  (autopay bool)
  (settler-reward uint))
  (let ((job-id (var-get next-job-id)))
    (map-set jobs job-id {
      organizer: tx-sender,
      budget: budget,
      min-stake: min-stake,
      commit-until: commit-until,
      reveal-until: reveal-until,
      inputs-len: inputs-len,
      seed-hash: seed-hash,
      seed: none,
      meta-uri: meta-uri,
      is-public: is-public,
      autopay: autopay,
      settler-reward: settler-reward,
      escrow: u0,
      settled: false
    })
    (var-set next-job-id (+ job-id u1))
    (print {event: "job-created", job-id: job-id, organizer: tx-sender})
    (ok job-id)))

;; Organizer funds escrow for the job
(define-public (fund (job-id uint) (amount uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (asserts! (is-eq (get organizer job) tx-sender) ERR-NOT-AUTHORIZED)
    ;; move STX from organizer to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set jobs job-id (merge job {escrow: (+ (get escrow job) amount)}))
    (print {event: "job-funded", job-id: job-id, amount: amount})
    (ok true)))

;; Worker registers and stakes min-stake
(define-public (register-worker (job-id uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
        (min-stake (get min-stake job)))
    (asserts! (< block-height (get commit-until job)) ERR-DEADLINE-PASSED)
    (asserts! (is-none (map-get? workers {job-id: job-id, worker: tx-sender})) ERR-ALREADY-EXISTS)
    ;; move stake from worker to contract
    (try! (stx-transfer? min-stake tx-sender (as-contract tx-sender)))
    (map-set workers {job-id: job-id, worker: tx-sender} {
      staked: min-stake,
      result-root: none,
      commit-height: none,
      claimed: false
    })
    (map-set stakes tx-sender (+ (default-to u0 (map-get? stakes tx-sender)) min-stake))
    (print {event: "worker-registered", job-id: job-id, worker: tx-sender, stake: min-stake})
    (ok true)))

;; Commit a Merkle root of results
(define-public (commit-result (job-id uint) (result-root (buff 32)))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
        (worker (unwrap! (map-get? workers {job-id: job-id, worker: tx-sender}) ERR-NOT-AUTHORIZED)))
    (asserts! (< block-height (get commit-until job)) ERR-DEADLINE-PASSED)
    (map-set workers {job-id: job-id, worker: tx-sender} 
      (merge worker {
        result-root: (some result-root),
        commit-height: (some block-height)
      }))
    (print {event: "result-committed", job-id: job-id, worker: tx-sender, root: result-root})
    (ok true)))

;; Organizer reveals the random seed (preimage of seed-hash)
(define-public (reveal-seed (job-id uint) (secret (buff 32)))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (asserts! (is-eq (get organizer job) tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (sha256 secret) (get seed-hash job)) ERR-INVALID-SEED)
    (asserts! (>= block-height (get commit-until job)) ERR-DEADLINE-PASSED)
    (map-set jobs job-id (merge job {seed: (some secret)}))
    (print {event: "seed-revealed", job-id: job-id})
    (ok true)))

;; Claim payout by providing samples proving the root matches challenges
(define-public (claim 
  (job-id uint)
  (samples (list 10 {index: uint, label: uint, branch: (list 16 {dir: bool, hash: (buff 32)})})))
  (let (
        (job         (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
        (worker      (unwrap! (map-get? workers {job-id: job-id, worker: tx-sender}) ERR-NOT-AUTHORIZED))
        (seed        (unwrap! (get seed job) ERR-NOT-REVEALED))
        (result-root (unwrap! (get result-root worker) ERR-NOT-AUTHORIZED))
        (caller      tx-sender)
       )
    (asserts! (not (get settled job)) ERR-ALREADY-SETTLED)
    (asserts! (not (get claimed worker)) ERR-ALREADY-CLAIMED)
    ;; claim window: after commit-until and before reveal-until
    (asserts! (and (>= block-height (get commit-until job))
                   (<  block-height (get reveal-until job))) ERR-DEADLINE-PASSED)
    (asserts! (is-eq (len samples) u10) ERR-INVALID-PROOF)
    (asserts! (verify-all-samples samples job-id seed (get inputs-len job) result-root) ERR-INVALID-PROOF)

    (let (
          (payout-amount (get budget job))
          (stake-amount  (get staked worker))
          (total-out     (+ (get budget job) (get staked worker)))
         )
      ;; ensure escrow covers both payout and stake refund
      (asserts! (>= (get escrow job) total-out) ERR-INSUFFICIENT-FUNDS)

      ;; Payouts from contract principal
      (try! (as-contract (stx-transfer? payout-amount tx-sender caller)))
      (try! (as-contract (stx-transfer? stake-amount  tx-sender caller)))

      ;; Mark settled and reduce escrow
      (map-set jobs job-id (merge job {settled: true, escrow: (- (get escrow job) total-out)}))
      (map-set workers {job-id: job-id, worker: tx-sender} (merge worker {claimed: true}))
      (map-set stakes  tx-sender (- (default-to u0 (map-get? stakes tx-sender)) stake-amount))

      (print {event: "claim-verified", job-id: job-id, worker: tx-sender})
      (print {event: "payout-sent",    job-id: job-id, worker: tx-sender, amount: payout-amount})
      (print {event: "job-settled",    job-id: job-id})
      (ok true)))))

;; Finalize after reveal window; refunds organizer if no valid claim
(define-public (finalize (job-id uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (asserts! (>= block-height (get reveal-until job)) ERR-DEADLINE-PASSED)
    (asserts! (not (get settled job)) ERR-ALREADY-SETTLED)
    (asserts! (> (get escrow job) u0) ERR-NO-ESCROW)
    (let (
          (refund-amount (- (get escrow job) (get settler-reward job)))
          (reward        (get settler-reward job))
          (caller        tx-sender)
         )
      (try! (as-contract (stx-transfer? refund-amount tx-sender (get organizer job))))
      (if (> reward u0)
          (try! (as-contract (stx-transfer? reward tx-sender caller)))
          true)
      (map-set jobs job-id (merge job {settled: true, escrow: u0}))
      (print {event: "job-finalized", job-id: job-id})
      (ok true))))

;; Organizer fallback attestation to pay a given worker
(define-public (attest-valid (job-id uint) (worker principal) (payout uint))
  (let (
        (job         (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
        (worker-data (unwrap! (map-get? workers {job-id: job-id, worker: worker}) ERR-NOT-AUTHORIZED))
       )
    (asserts! (is-eq (get organizer job) tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (get settled job)) ERR-ALREADY-SETTLED)
    (asserts! (>= (get escrow job) payout) ERR-INSUFFICIENT-FUNDS)
    (try! (as-contract (stx-transfer? payout tx-sender worker)))
    (map-set jobs job-id (merge job {settled: true, escrow: (- (get escrow job) payout)}))
    (print {event: "attested-valid", job-id: job-id, worker: worker, payout: payout})
    (ok true)))

;; -----------------------------
;; Read-only views
;; -----------------------------
(define-read-only (get-next-job-id)
  (var-get next-job-id))

(define-read-only (get-job (job-id uint))
  (map-get? jobs job-id))

(define-read-only (get-worker (job-id uint) (worker principal))
  (map-get? workers {job-id: job-id, worker: worker}))

;; One-time set of an optional trophy contract address
(define-public (set-trophy-contract (trophy-addr principal))
  (begin
    (asserts! (is-none (var-get trophy-contract)) ERR-ALREADY-EXISTS)
    (var-set trophy-contract (some trophy-addr))
    (ok true)))

;; -----------------------------
;; Private helpers
;; -----------------------------

;; Compute the challenge index deterministically from seed, job-id, k
;; Uses first 16 bytes of sha256(seed || job-id || k) as a big-endian uint
(define-private (compute-challenge-index (seed (buff 32)) (job-id uint) (k uint) (inputs-len uint))
  (let (
        (job-id-buff (unwrap-panic (to-consensus-buff? job-id)))
        (k-buff      (unwrap-panic (to-consensus-buff? k)))
        (hash        (sha256 (concat seed (concat job-id-buff k-buff))))
        (hi          (slice hash u0 u16))
       )
    (asserts! (> inputs-len u0) ERR-ZERO-INPUTS)
    (mod (buff-to-uint-be hi) inputs-len)))

;; Verify a Merkle proof for (index,label) under root
(define-private (verify-merkle-proof 
  (root (buff 32))
  (index uint)
  (label uint)
  (branch (list 16 {dir: bool, hash: (buff 32)})))
  (let ((leaf-hash (compute-leaf-hash index label)))
    (is-eq root (fold verify-branch-step branch leaf-hash))))

;; Compute leaf hash domain-separated by 0x00
(define-private (compute-leaf-hash (index uint) (label uint))
  (let ((index-buff (unwrap-panic (to-consensus-buff? index)))
        (label-buff (unwrap-panic (to-consensus-buff? label))))
    (sha256 (concat 0x00 (concat index-buff label-buff)))))

;; Process one node of a branch; domain-separate by 0x01
(define-private (verify-branch-step 
  (node {dir: bool, hash: (buff 32)})
  (current-hash (buff 32)))
  (if (get dir node)
      ;; sibling on the right
      (sha256 (concat 0x01 (concat current-hash (get hash node))))
      ;; sibling on the left
      (sha256 (concat 0x01 (concat (get hash node) current-hash)))))

;; Verify samples (simplified: checks only first sample for now)
(define-private (verify-all-samples 
  (samples (list 10 {index: uint, label: uint, branch: (list 16 {dir: bool, hash: (buff 32)})}))
  (job-id uint)
  (seed (buff 32))
  (inputs-len uint)
  (result-root (buff 32)))
  (let ((sample (unwrap-panic (element-at samples u0)))
        (expected-index (compute-challenge-index seed job-id u0 inputs-len)))
    (and (is-eq (get index sample) expected-index)
         (verify-merkle-proof result-root (get index sample) (get label sample) (get branch sample)))))
