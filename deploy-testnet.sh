#!/bin/bash
# StackCompute Testnet Deployment Script

echo "🚀 Deploying StackCompute to Stacks Testnet..."

# Set deployment variables
PRIVATE_KEY="9e8b9a199df358a0fc723a562880cadab3541faff85f169a50a15473f1fb014601"
ADDRESS="ST2RGRCTJBZ5SZAG564J9YKYQBYRHXMW5432GRW5X"
FEE="1000"
NONCE="0"

echo "📋 Deployment Info:"
echo "Address: $ADDRESS"
echo "Fee: $FEE microSTX"
echo ""

echo "📦 Deploying job-registry contract..."
stx deploy_contract contracts/job-registry.clar job-registry $FEE $NONCE $PRIVATE_KEY

echo ""
echo "📦 Deploying trophy-sbt contract..."
stx deploy_contract contracts/trophy-sbt.clar trophy-sbt $FEE 1 $PRIVATE_KEY

echo ""
echo "✅ Deployment complete!"
echo "🔗 Check your contracts at:"
echo "   - https://explorer.hiro.so/address/$ADDRESS?chain=testnet"
echo "   - https://explorer.hiro.so/txid/[TRANSACTION_ID]?chain=testnet"
