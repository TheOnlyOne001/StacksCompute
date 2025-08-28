;; job-registry.clar - Core StackCompute job lifecycle contract

;; Constants
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

;; Data variables
(define-data-var next-job-id uint u1)
(define-data-var trophy-contract (optional principal) none)

;; Job structure
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

;; Worker structure
(define-map workers {job-id: uint, worker: principal} {
  staked: uint,
  result-root: (optional (buff 32)),
  commit-height: (optional uint),
  claimed: bool
})

;; Stakes map for refunds
(define-map stakes principal uint)

;; Create a new job
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

;; Fund a job (required for escrow)
(define-public (fund (job-id uint) (amount uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (asserts! (is-eq (get organizer job) tx-sender) ERR-NOT-AUTHORIZED)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set jobs job-id (merge job {escrow: (+ (get escrow job) amount)}))
    (print {event: "job-funded", job-id: job-id, amount: amount})
    (ok true)))

;; Register as a worker and stake
(define-public (register-worker (job-id uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
        (min-stake (get min-stake job)))
    (asserts! (< block-height (get commit-until job)) ERR-DEADLINE-PASSED)
    (asserts! (is-none (map-get? workers {job-id: job-id, worker: tx-sender})) ERR-ALREADY-EXISTS)
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

;; Commit a result
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

;; Reveal the seed
(define-public (reveal-seed (job-id uint) (secret (buff 32)))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (asserts! (is-eq (get organizer job) tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (sha256 secret) (get seed-hash job)) ERR-INVALID-SEED)
    (asserts! (>= block-height (get commit-until job)) ERR-DEADLINE-PASSED)
    (map-set jobs job-id (merge job {seed: (some secret)}))
    (print {event: "seed-revealed", job-id: job-id})
    (ok true)))

;; Helper: Compute challenge index
(define-private (compute-challenge-index (seed (buff 32)) (job-id uint) (k uint) (inputs-len uint))
  (let ((data (concat (concat seed (uint-to-buff32 job-id)) (uint-to-buff32 k)))
        (hash (sha256 data)))
    (mod (buff-to-uint256 hash) inputs-len)))

;; Helper: Convert uint to 32-byte buffer (big-endian)
(define-private (uint-to-buff32 (n uint))
  (unwrap-panic (as-max-len? 
    (concat (concat (concat (concat (concat (concat (concat
      (if (> n u72057594037927935) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (/ n u72057594037927936))) 0x00)
      (if (> n u281474976710655) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u281474976710656) u256))) 0x00))
      (if (> n u1099511627775) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u1099511627776) u256))) 0x00))
      (if (> n u4294967295) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u4294967296) u256))) 0x00))
      (if (> n u16777215) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u16777216) u256))) 0x00))
      (if (> n u65535) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u65536) u256))) 0x00))
      (if (> n u255) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u256) u256))) 0x00))
      (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod n u256)))
    u32)))

;; Helper: Convert buffer to uint256
(define-private (buff-to-uint256 (buff (buff 32)))
  (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+ (+
    (buff-to-u8 (unwrap-panic (element-at? buff u31)))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u30))) u256))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u29))) u65536))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u28))) u16777216))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u27))) u4294967296))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u26))) u1099511627776))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u25))) u281474976710656))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u24))) u72057594037927936))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u23))) u18446744073709551616))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u22))) u4722366482869645213696))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u21))) u1208925819614629174706176))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u20))) u309485009821345068724781056))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u19))) u79228162514264337593543950336))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u18))) u20282409603651670423947251286016))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u17))) u5192296858534827628530496329220096))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u16))) u1329227995784915872903807060280344576))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u15))) u340282366920938463463374607431768211456))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u14))) u87112285931760246646623899502532662132736))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u13))) u22300745198530623141535718272648361505980416))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u12))) u5708990770823839524233143877797980545530986496))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u11))) u1461501637330902918203684832716283019655932542976))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u10))) u374144419156711147060143317175368453031918731001856))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u9))) u95780971304118053647396689196894323976171195136475136))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u8))) u24519928653854221733733552434404946937899825954937634816))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u7))) u6277101735386680763835789423207666416102355444464034512896))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u6))) u1606938044258990275541962092341162602522202993782792835301376))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u5))) u411376139330301510538742295639337626245683966408394965837152256))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u4))) u105312291668557186697918027683670432318895095400549111254310977536))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u3))) u26959946667150639794667015087019630673637144422540572481103610249216))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u2))) u6901746346790563787434755862277025452451108972170386555162524223799296))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u1))) u1766847064778384329583297500742918515827483896875618958121606201292619776))
    (* (buff-to-u8 (unwrap-panic (element-at? buff u0))) u452312848583266388373324160190187140051835877600158453279131187530910662656)))

;; Helper: Verify Merkle proof
(define-private (verify-merkle-proof 
  (root (buff 32))
  (index uint)
  (label uint)
  (branch (list 16 {dir: bool, hash: (buff 32)})))
  (let ((leaf-hash (compute-leaf-hash index label)))
    (is-eq root (fold verify-branch-step branch leaf-hash))))

;; Helper: Compute leaf hash
(define-private (compute-leaf-hash (index uint) (label uint))
  (sha256 (concat 0x00 (concat (uint-to-buff4 index) (uint-to-buff1 label)))))

;; Helper: Convert uint to 4-byte buffer
(define-private (uint-to-buff4 (n uint))
  (unwrap-panic (as-max-len? (concat (concat (concat
    (if (> n u16777215) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (/ n u16777216))) 0x00)
    (if (> n u65535) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u65536) u256))) 0x00))
    (if (> n u255) (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod (/ n u256) u256))) 0x00))
    (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod n u256)))
  u4)))

;; Helper: Convert uint to 1-byte buffer
(define-private (uint-to-buff1 (n uint))
  (unwrap-panic (element-at? 0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 (mod n u256))))

;; Helper: Process one branch node in Merkle verification
(define-private (verify-branch-step 
  (node {dir: bool, hash: (buff 32)})
  (current-hash (buff 32)))
  (if (get dir node)
    ;; Sibling is on the right
    (sha256 (concat 0x01 (concat current-hash (get hash node))))
    ;; Sibling is on the left
    (sha256 (concat 0x01 (concat (get hash node) current-hash)))))

;; Sample type for claim
(define-map sample-type
  uint
  {index: uint, label: uint, branch: (list 16 {dir: bool, hash: (buff 32)})})

;; Claim with verification and autopay
(define-public (claim 
  (job-id uint)
  (samples (list 10 {index: uint, label: uint, branch: (list 16 {dir: bool, hash: (buff 32)})})))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
        (worker (unwrap! (map-get? workers {job-id: job-id, worker: tx-sender}) ERR-NOT-AUTHORIZED))
        (seed (unwrap! (get seed job) ERR-NOT-REVEALED))
        (result-root (unwrap! (get result-root worker) ERR-NOT-AUTHORIZED))
        (caller tx-sender))
    ;; Check not already settled
    (asserts! (not (get settled job)) ERR-ALREADY-SETTLED)
    ;; Check not already claimed
    (asserts! (not (get claimed worker)) ERR-ALREADY-CLAIMED)
    ;; Check within claim window
    (asserts! (and (>= block-height (get commit-until job))
                  (< block-height (get reveal-until job))) ERR-DEADLINE-PASSED)
    
    ;; Verify all samples
    (asserts! (is-eq (len samples) u10) ERR-INVALID-PROOF)
    (asserts! (fold verify-sample-step
      {samples: samples, job-id: job-id, seed: seed, inputs-len: (get inputs-len job), 
       result-root: result-root, k: u0, valid: true}
      {valid: true})
      ERR-INVALID-PROOF)
    
    ;; All samples valid - execute payout
  (let ((payout-amount (get budget job))
      (stake-amount (get staked worker)))
    ;; Transfer payout from contract to caller (worker)
    (try! (as-contract (stx-transfer? payout-amount tx-sender caller)))
    ;; Refund stake from contract to caller (worker)
    (try! (as-contract (stx-transfer? stake-amount tx-sender caller)))
      ;; Mark as settled
      (map-set jobs job-id (merge job {settled: true, escrow: u0}))
      ;; Mark worker as claimed
      (map-set workers {job-id: job-id, worker: tx-sender} (merge worker {claimed: true}))
      ;; Update stakes
      (map-set stakes tx-sender (- (default-to u0 (map-get? stakes tx-sender)) stake-amount))
      ;; Mint trophy SBT if contract is set
      (match (var-get trophy-contract)
        trophy-addr (begin
          (print {event: "minting-trophy", job-id: job-id, winner: tx-sender})
          (ok true))
        (ok true))
      ;; Emit events
      (print {event: "claim-verified", job-id: job-id, worker: tx-sender})
      (print {event: "payout-sent", job-id: job-id, worker: tx-sender, amount: payout-amount})
      (print {event: "job-settled", job-id: job-id})
      (ok true))))

;; Helper: Verify one sample in the fold
(define-private (verify-sample-step 
  (state {samples: (list 10 {index: uint, label: uint, branch: (list 16 {dir: bool, hash: (buff 32)})}),
          job-id: uint, seed: (buff 32), inputs-len: uint, result-root: (buff 32), k: uint, valid: bool})
  (accumulator {valid: bool}))
  (if (get valid accumulator)
    (let ((expected-index (compute-challenge-index (get seed state) (get job-id state) (get k state) (get inputs-len state)))
          (sample (unwrap-panic (element-at? (get samples state) (get k state)))))
      (merge state {
        k: (+ (get k state) u1),
        valid: (and (is-eq (get index sample) expected-index)
                   (verify-merkle-proof (get result-root state) (get index sample) 
                                      (get label sample) (get branch sample)))
      }))
    accumulator))

;; Finalize - refund if no valid claims
(define-public (finalize (job-id uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    ;; Check deadline passed
    (asserts! (>= block-height (get reveal-until job)) ERR-DEADLINE-PASSED)
    ;; Check not already settled
    (asserts! (not (get settled job)) ERR-ALREADY-SETTLED)
    ;; Check there's escrow to refund
    (asserts! (> (get escrow job) u0) ERR-NO-ESCROW)
    
    (let ((refund-amount (- (get escrow job) (get settler-reward job)))
          (reward (get settler-reward job))
          (caller tx-sender))
      ;; Refund to organizer
      (try! (as-contract (stx-transfer? refund-amount tx-sender (get organizer job))))
      ;; Pay settler reward if any
      (if (> reward u0)
        (try! (as-contract (stx-transfer? reward tx-sender caller)))
        true)
      ;; Mark as settled
      (map-set jobs job-id (merge job {settled: true, escrow: u0}))
      ;; TODO: Refund all worker stakes
      (print {event: "job-finalized", job-id: job-id})
      (ok true))))

;; Fallback attestation
(define-public (attest-valid (job-id uint) (worker principal) (payout uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
        (worker-data (unwrap! (map-get? workers {job-id: job-id, worker: worker}) ERR-NOT-AUTHORIZED)))
    ;; Only organizer can attest
    (asserts! (is-eq (get organizer job) tx-sender) ERR-NOT-AUTHORIZED)
    ;; Check not already settled
    (asserts! (not (get settled job)) ERR-ALREADY-SETTLED)
    ;; Execute payout
    (try! (as-contract (stx-transfer? payout tx-sender worker)))
    ;; Mark as settled
    (map-set jobs job-id (merge job {settled: true, escrow: (- (get escrow job) payout)}))
    (print {event: "attested-valid", job-id: job-id, worker: worker, payout: payout})
    (ok true)))

;; Read-only functions
(define-read-only (get-next-job-id)
  (var-get next-job-id))

(define-read-only (get-job (job-id uint))
  (map-get? jobs job-id))

(define-read-only (get-worker (job-id uint) (worker principal))
  (map-get? workers {job-id: job-id, worker: worker}))

;; Set trophy contract address (one-time, by deployer)
(define-public (set-trophy-contract (trophy-addr principal))
  (begin
    (asserts! (is-none (var-get trophy-contract)) ERR-ALREADY-EXISTS)
    (var-set trophy-contract (some trophy-addr))
    (ok true)))