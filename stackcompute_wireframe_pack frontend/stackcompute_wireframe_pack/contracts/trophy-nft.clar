(define-non-fungible-token trophy uint)
(define-map awarded {job: uint, who: principal} {ok: bool})

(define-public (mint (job uint) (who principal) (id uint))
  (if (is-eq tx-sender (contract-owner))
      (begin
        (try! (nft-mint? trophy id who))
        (map-set awarded {job: job, who: who} {ok: true})
        (ok id))
      (err u401)))
