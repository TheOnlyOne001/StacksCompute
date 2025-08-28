# Sample off-chain verifier (sketch).
# In the hackathon demo, this script would:
# 1) load the revealed seed from chain
# 2) derive challenge indices deterministically
# 3) check the worker's sample outputs against a known dataset or scoring function
# 4) produce an attestation (signed message) for the contract

import hashlib, json, random

def derive_indices(seed: bytes, n_total: int, k: int):
    # Deterministic pseudorandom indices
    rnd = int(hashlib.sha256(seed).hexdigest(), 16)
    random.seed(rnd)
    return sorted(random.sample(range(n_total), k))

if __name__ == "__main__":
    seed = b"demo-seed"
    idx = derive_indices(seed, n_total=1000, k=10)
    print("Challenge indices:", idx)
