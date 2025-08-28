# StackCompute - Next Steps

## ✅ Completed So Far

### 1. Proof-of-Concept & Test Vectors
- ✅ `sampler.ts` - Challenge index derivation
- ✅ `merkle.ts` - Merkle tree with directional proofs
- ✅ Generated test vectors in `tests/vectors.json`
- ✅ Merkle Root: `0x8250c95ae1efb84fb56e24bce9260af8e526662f50d17ebc7a64fcc28068cb90`

### 2. Smart Contracts
- ✅ `job-registry.clar` - All functions implemented with corrections
- ✅ `trophy-sbt.clar` - Non-transferable NFT
- ✅ Clarinet.toml configuration
- ✅ Test file created (needs Clarinet to run)

## 🚀 Next Steps (In Order)

### 1. Install Clarinet & Run Tests
```bash
# Install Clarinet
winget install clarinet
# or download from https://github.com/hirosystems/clarinet/releases

# Run tests
clarinet test

# Fix any issues until all tests pass
```

### 2. Deploy to Testnet
```bash
# Deploy contracts
clarinet deployments generate --testnet
clarinet deployments apply -p deployments/testnet.devnet-plan.yaml

# Record the deployed addresses
```

Create `deploy/DEPLOY_NOTES.md` with:
- Contract addresses
- Transaction IDs
- Explorer links

### 3. Run Manual Test Transaction
Execute the full flow on testnet:
1. create-job
2. fund
3. register-worker
4. commit-result
5. reveal-seed
6. claim

Verify on explorer that:
- Autopay executed
- Trophy minted
- Events emitted

### 4. Start Frontend Development
```bash
# Create Next.js app
npx create-next-app@latest app --typescript --tailwind --app
cd app

# Install dependencies
npm install @stacks/connect @stacks/transactions @stacks/network

# Copy utils
cp ../utils/* ./utils/
```

Configure `.env.local`:
```
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_JOB_REGISTRY_ADDRESS=<your-deployed-address>
NEXT_PUBLIC_TROPHY_SBT_ADDRESS=<your-deployed-address>
```

## 📋 Quick Sanity Checklist

- [x] Leaf hash: `sha256(0x00 || idx[4] || label[1])`
- [x] Inner hash: `sha256(0x01 || left || right)`
- [x] Branch includes direction bit
- [x] Challenge indices computed on-chain
- [x] Post-conditions will cap contract outflows
- [x] Duplicates in indices are acceptable
- [x] fund() exists for deposits
- [x] Autopay in claim()
- [x] Trophy mint simplified (no cross-contract call)

## 🎯 Implementation Order for UI

1. **Wallet Connect** - Single button for Leather
2. **Marketplace** - List jobs from contract
3. **Create & Fund** - Two-step job creation
4. **Provider Console** - Compute, commit, claim
5. **Renter Dashboard** - Reveal seed only
6. **Public/TV** - Status display with confetti

## 🔑 Key Integration Points

1. **Test Vectors** - Use `tests/vectors.json` for:
   - Verifying challenge indices match
   - Testing Merkle proof generation
   - Ensuring claim will succeed

2. **Post-Conditions** - Required on:
   - `fund`: Optional (cap deposit)
   - `claim`: From contract ≤ budget
   - `finalize`: From contract ≤ budget

3. **Transaction Monitoring**:
   - Show pending/confirmed states
   - Link to explorer
   - Update UI on settlement

## ⚠️ Critical Notes

1. The seed for test vectors is:
   `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
   
2. The SHA256 of this seed is:
   `0xc1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46`

3. Use this exact seed when testing to ensure proofs match!

4. The contract expects samples in format:
   ```clarity
   {index: uint, label: uint, branch: (list 16 {dir: bool, hash: (buff 32)})}
   ```

5. Convert TypeScript proofs to this format carefully!