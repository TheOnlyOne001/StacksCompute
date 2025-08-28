# Testnet Deployment Credentials

## ⚠️ TESTNET ONLY - DO NOT USE FOR MAINNET ⚠️

### Generated Testnet Wallet
- **Address**: ST2RGRCTJBZ5SZAG564J9YKYQBYRHXMW5432GRW5X
- **Private Key**: 9e8b9a199df358a0fc723a562880cadab3541faff85f169a50a15473f1fb014601
- **Mnemonic**: home account arch need deer rack mind minimum century below again angle garment gas stairs sphere claim cricket father across index dragon code pride

### Next Steps
1. Get testnet STX from faucet
2. Deploy contracts to testnet
3. Test all functions
4. Generate mainnet wallet for production

### Faucet URLs
- Hiro Faucet: https://explorer.hiro.so/sandbox/faucet?chain=testnet
- Alternative: https://www.hiro.so/wallet-faq

### Deployment Commands (Ready to Use)
```bash
# Deploy job-registry contract
stx deploy_contract contracts/job-registry.clar job-registry 1000 0 9e8b9a199df358a0fc723a562880cadab3541faff85f169a50a15473f1fb014601

# Deploy trophy-sbt contract  
stx deploy_contract contracts/trophy-sbt.clar trophy-sbt 1000 0 9e8b9a199df358a0fc723a562880cadab3541faff85f169a50a15473f1fb014601
```

### Contract Addresses (After Deployment)
- job-registry: ST2RGRCTJBZ5SZAG564J9YKYQBYRHXMW5432GRW5X.job-registry
- trophy-sbt: ST2RGRCTJBZ5SZAG564J9YKYQBYRHXMW5432GRW5X.trophy-sbt
