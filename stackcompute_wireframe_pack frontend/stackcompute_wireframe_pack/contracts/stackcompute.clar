(define-data-var next-job-id uint u1)

(define-map jobs
  {id: uint}
  {
    organizer: principal,
    token: (optional principal), ;; None -> STX, Some -> SIP010 FT
    budget: uint,
    min-stake: uint,
    commit-until: uint,  ;; block height
    reveal-until: uint,  ;; block height
    seed-hash: (buff 32),
    seed-revealed: bool,
    settled: bool
  }
)

(define-map attestors {job: uint, who: principal} {ok: bool})

(define-map worker-stakes {job: uint, who: principal} {amount: uint})
(define-map worker-commits {job: uint, who: principal} {root: (buff 32)})
(define-map worker-reveals {job: uint, who: principal} {samples-hash: (buff 32)})
(define-map payouts {job: uint, who: principal} {paid: bool, amount: uint})

(define-constant ERR-NOT-ORG (err u100))
(define-constant ERR-TIME (err u101))
(define-constant ERR-ALREADY (err u102))
(define-constant ERR-NO-STAKE (err u103))
(define-constant ERR-NO-COMMIT (err u104))
(define-constant ERR-NO-REVEAL (err u105))
(define-constant ERR-NOT-ATTESTOR (err u106))

(define-public (create-job (token (optional principal)) (budget uint) (min-stake uint) (commit-until uint) (reveal-until uint) (seed-hash (buff 32)))
  (let
    (
      (id (var-get next-job-id))
    )
    (begin
      (var-set next-job-id (+ id u1))
      (map-set jobs {id: id}
        {
          organizer: tx-sender,
          token: token,
          budget: budget,
          min-stake: min-stake,
          commit-until: commit-until,
          reveal-until: reveal-until,
          seed-hash: seed-hash,
          seed-revealed: false,
          settled: false
        })
      (ok id)
    )
  )
)

;; organizer adds an attestor
(define-public (add-attestor (job uint) (who principal))
  (let ((j (map-get? jobs {id: job})))
    (if (is-some j)
      (let ((org (get organizer (unwrap-panic j))))
        (if (is-eq org tx-sender)
          (begin (map-set attestors {job: job, who: who} {ok: true}) (ok true))
          ERR-NOT-ORG))
      (err u1))))

;; worker registers and stakes STX (MVP). For FT staking, add a separate function.
(define-public (register-worker (job uint))
  (let ((j (map-get? jobs {id: job})))
    (if (is-some j)
      (let ((min (get min-stake (unwrap-panic j))))
        (begin
          (try! (stx-transfer? min tx-sender (as-contract tx-sender)))
          (map-set worker-stakes {job: job, who: tx-sender} {amount: min})
          (ok true)))
      (err u1))))

(define-public (commit-result (job uint) (root (buff 32)))
  (let ((j (map-get? jobs {id: job})))
    (if (is-some j)
      (let ((deadline (get commit-until (unwrap-panic j))))
        (if (<= block-height deadline)
          (begin
            (map-set worker-commits {job: job, who: tx-sender} {root: root})
            (ok true))
          ERR-TIME))
      (err u1))))

(define-public (reveal-seed (job uint) (secret (buff 32)))
  (let ((j (map-get? jobs {id: job})))
    (if (is-some j)
      (let ((org (get organizer (unwrap-panic j)))
            (hash (get seed-hash (unwrap-panic j))))
        (if (is-eq org tx-sender)
          (if (is-eq (sha256 secret) hash)
            (begin
              (map-set jobs {id: job} (merge (unwrap-panic j) {seed-revealed: true}))
              (ok true))
            (err u200))
          ERR-NOT-ORG))
      (err u1))))

;; Optional attestation path (fallback to avoid heavy on-chain verification)
(define-public (attest-valid (job uint) (who principal) (passed bool) (amount uint))
  (let ((is-att (get ok (default-to {ok: false} (map-get? attestors {job: job, who: tx-sender}))))
        (j (map-get? jobs {id: job})))
    (if (not is-att) ERR-NOT-ATTESTOR
      (begin
        (if passed
          (map-set payouts {job: job, who: who} {paid: false, amount: amount})
          (map-delete payouts {job: job, who: who}))
        (ok passed))))

;; Settle: pay all attested winners equally or by pre-set amounts (MVP uses payouts map).
(define-public (settle (job uint))
  (let ((j (map-get? jobs {id: job})))
    (if (is-some j)
      (let ((org (get organizer (unwrap-panic j))))
        (if (is-eq org tx-sender)
          (begin
            (var-set next-job-id (var-get next-job-id)) ;; no-op to keep state change
            ;; iterate over payouts map is not trivial in Clarity; in MVP, organizer passes a list off-chain.
            (ok true))
          ERR-NOT-ORG))
      (err u1))))
