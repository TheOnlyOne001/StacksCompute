# StackCompute Implementation Status

## ✅ Completed: Proof-of-Concept & Smart Contracts

### 1. Proof-of-Concept (TypeScript)
- **sampler.ts**: Challenge index derivation
  - Formula: `sha256(seed || jobId || k) mod N`
  - Generates deterministic indices for verification
  
- **merkle.ts**: Merkle proof generation and verification
  - Leaf format: `sha256(0x00 || index[4] || label[1])`
  - Inner format: `sha256(0x01 || left || right)`
  - Branch format: `{dir: boolean, hash: string}`

- **Test Vectors**: Generated and saved to `tests/vectors.json`
  - Seed: `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
  - Merkle Root: `0x8250c95ae1efb84fb56e24bce9260af8e526662f50d17ebc7a64fcc28068cb90`
  - Challenge Indices: [72, 68, 3, 42, 39, 10, 21, 43, 79, 3]

### 2. Smart Contracts (Clarity)

#### job-registry.clar
Core functions implemented:
- `create-job` - Creates job with all parameters including inputs-len
- `fund` - **NEW** Deposits STX into escrow (required!)
- `register-worker` - Stakes minimum amount
- `commit-result` - Stores Merkle root + commit height
- `reveal-seed` - Verifies sha256(secret) == seed-hash
- `claim` - **Autopay** with Merkle proof verification in single tx
- `finalize` - Backstop for refunds with optional settler-reward
- `attest-valid` - Fallback manual validation

Read-only functions:
- `get-next-job-id`
- `get-job`
- `get-worker`

Key features:
- ✅ On-chain challenge index computation
- ✅ Merkle verification with directional branches
- ✅ Domain-separated hashing (0x00/0x01)
- ✅ Automatic payout + stake refund + SBT mint in claim()
- ✅ Comprehensive event emissions

#### trophy-sbt.clar
- Non-transferable NFT for winners
- `mint` - Only callable by registry contract
- `transfer` - Overridden to always fail (Soul Bound)
- Metadata URI support

## 🚀 Ready for Frontend Development

The contract ABI is now frozen with:
- Exact function signatures defined
- Event structure established
- Test vectors available for verification
- Post-condition requirements documented

### Critical Implementation Notes:

1. **Must use `fund()` for deposits** - Cannot send STX directly to contract
2. **Autopay happens in `claim()`** - No separate settle step
3. **Post-conditions required on**:
   - `fund`: Optional (cap exact deposit)
   - `claim`: From contract ≤ budget
   - `finalize`: From contract ≤ budget

4. **Challenge indices are computed on-chain** - Must match TypeScript implementation
5. **Merkle proofs use directional branches** - dir=false (left), dir=true (right)

## Next Steps

1. Deploy contracts to testnet
2. Build Next.js frontend with:
   - Leather wallet integration
   - Post-conditions on transactions
   - In-browser compute matching test vectors
   - Real-time transaction tracking

## Test Data for Demo

Use the generated test vectors in `tests/vectors.json` to ensure frontend and contract compute identical:
- Challenge indices
- Merkle roots
- Proof branches

This ensures the UI and contract will work together correctly during the demo.