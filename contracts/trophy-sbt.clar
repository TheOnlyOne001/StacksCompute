;; trophy-sbt.clar - Non-transferable Soul Bound Token for winners

;; Define the non-fungible token
(define-non-fungible-token trophy uint)

;; Error constants
(define-constant ERR-NOT-AUTHORIZED (err u200))
(define-constant ERR-ALREADY-MINTED (err u201))
(define-constant ERR-NOT-OWNER (err u202))
(define-constant ERR-TRANSFER-FORBIDDEN (err u203))

;; Data variables
(define-data-var next-token-id uint u1)
(define-data-var registry-contract principal tx-sender)

;; Maps to track awards
(define-map awarded {job-id: uint, winner: principal} {token-id: uint})
(define-map token-job-mapping uint uint) ;; token-id -> job-id

;; Mint a trophy (only callable by registry contract)
(define-public (mint (job-id uint) (winner principal))
  (let ((token-id (var-get next-token-id)))
    ;; Only registry contract can mint
    (asserts! (is-eq tx-sender (var-get registry-contract)) ERR-NOT-AUTHORIZED)
    ;; Check not already awarded for this job
    (asserts! (is-none (map-get? awarded {job-id: job-id, winner: winner})) ERR-ALREADY-MINTED)
    ;; Mint the NFT
    (try! (nft-mint? trophy token-id winner))
    ;; Record the award
    (map-set awarded {job-id: job-id, winner: winner} {token-id: token-id})
    (map-set token-job-mapping token-id job-id)
    ;; Increment token ID
    (var-set next-token-id (+ token-id u1))
    ;; Emit event
    (print {event: "trophy-minted", job-id: job-id, winner: winner, token-id: token-id})
    (ok true)))

;; Override transfer to make it non-transferable (Soul Bound)
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  ERR-TRANSFER-FORBIDDEN)

;; Read-only functions
(define-read-only (get-owner (token-id uint))
  (nft-get-owner? trophy token-id))

(define-read-only (get-job-id (token-id uint))
  (map-get? token-job-mapping token-id))

(define-read-only (get-trophy (job-id uint) (winner principal))
  (map-get? awarded {job-id: job-id, winner: winner}))

(define-read-only (get-next-token-id)
  (var-get next-token-id))

;; URI functions for metadata
(define-read-only (get-token-uri (token-id uint))
  (ok (some (concat "https://stackcompute.com/api/trophy/" (uint-to-string token-id)))))

(define-read-only (get-last-token-id)
  (ok (- (var-get next-token-id) u1)))

;; Helper to convert uint to string (simplified version)
(define-private (uint-to-string (value uint))
  (if (is-eq value u0)
    "0"
    (get-numeric-string value)))

(define-private (get-numeric-string (value uint))
  (if (is-eq value u0) ""
    (let ((last-digit (mod value u10))
          (rest (/ value u10)))
      (concat 
        (if (> rest u0) (get-numeric-string rest) "")
        (unwrap-panic (element-at? "0123456789" last-digit))))))

;; Set registry contract (one-time setup by deployer)
(define-public (set-registry-contract (registry principal))
  (begin
    (asserts! (is-eq tx-sender (var-get registry-contract)) ERR-NOT-AUTHORIZED)
    (var-set registry-contract registry)
    (ok true)))