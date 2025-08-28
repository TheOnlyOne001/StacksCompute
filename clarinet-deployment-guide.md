# Clarinet 3.4.0 Deployment Guide

## Current Issue
You're experiencing the error **"unable to retrieve default deployer account"** with Clarinet v3.4.0. This is a common issue with the newer version that requires proper deployment configuration.

## Solution

### 1. Fix the Deployer Account Configuration

The newer Clarinet version requires explicit deployer configuration in your settings files. You need to update your `settings/Devnet.toml`, `settings/Testnet.toml`, and `settings/Mainnet.toml` files.

**Update `settings/Devnet.toml`:**
```toml
[network]
name = "devnet"

[[network.accounts]]
name = "deployer"
mnemonic = "twice kind fence tip hidden tilt action fragile skin nothing glory cousin green tomorrow spring wrist shed math olympic multiply hip blue scout claw"
balance = 100_000_000_000_000

[[network.accounts]]
name = "wallet_1"
mnemonic = "sell invite acquire kitten bamboo drastic jelly vivid peace spawn twice guilt pave pen trash pretty park cube fragile unaware remain midnight betray rebuild"
balance = 100_000_000_000_000

[[network.accounts]]
name = "wallet_2"
mnemonic = "hold excess usual excess ring elephant install account glad dry fragile donkey gaze humble truck breeze nation gasp vacuum limb head keep delay hospital"
balance = 100_000_000_000_000

# Add more wallet configurations as needed
```

### 2. For Testnet Deployment

**Update `settings/Testnet.toml`:**
```toml
[network]
name = "testnet"
stacks_node_rpc_address = "https://stacks-node-api.testnet.stacks.co"
bitcoin_node_rpc_address = "https://bitcoind.testnet.stacks.co:18332"

[[network.accounts]]
name = "deployer"
mnemonic = "your-actual-testnet-wallet-mnemonic-here"
balance = 100_000_000_000_000
```

### 3. Generate Deployment Plan

Once your settings are configured:

```bash
# For testnet
clarinet deployments generate --testnet --low-cost

# For mainnet (be very careful!)
clarinet deployments generate --mainnet --low-cost
```

### 4. Apply Deployment

```bash
# For testnet
clarinet deployments apply --testnet

# For mainnet
clarinet deployments apply --mainnet
```

## Alternative: Use Clarinet Console

If you're still having issues, try using the console for local testing:

```bash
# Start a clarinet console session
clarinet console

# Or use the integrate command for full devnet
clarinet integrate
```

## Testing Without Deployment

For immediate testing, you can use the modern Vitest tests:

1. Make sure your tests are in `tests/modern/` directory
2. Run: `npm test`
3. Fix the deployer account issue by creating a proper test configuration

## Key Changes in Clarinet v3.4.0

1. **Explicit deployer configuration required** - No more automatic deployer detection
2. **New command structure** - `clarinet deployments` instead of `clarinet deployment`
3. **Updated settings format** - Network accounts must be properly configured
4. **Removed `test` command** - Use `clarinet console` or modern Vitest framework

## Next Steps

1. **Fix your settings files** with proper deployer account configuration
2. **Test locally first** using `clarinet console`
3. **Deploy to testnet** before considering mainnet
4. **Use modern testing framework** (`npm test` with Vitest) for better development experience

## Deployment Options Summary

| Environment | Purpose | Cost | Risk |
|-------------|---------|------|------|
| **Simnet** | Local testing | Free | None |
| **Devnet** | Local blockchain | Free | None |
| **Testnet** | Live testing | Free (test STX) | Low |
| **Mainnet** | Production | Real STX | High |

Start with **Devnet/Simnet** for development, move to **Testnet** for final testing, then **Mainnet** for production deployment.