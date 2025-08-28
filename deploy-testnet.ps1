# StackCompute Testnet Deployment Script for Windows PowerShell

Write-Host "🚀 Deploying StackCompute to Stacks Testnet..." -ForegroundColor Green

# Set deployment variables
$PRIVATE_KEY = "9e8b9a199df358a0fc723a562880cadab3541faff85f169a50a15473f1fb014601"
$ADDRESS = "ST2RGRCTJBZ5SZAG564J9YKYQBYRHXMW5432GRW5X"
$FEE = "1000"

Write-Host "📋 Deployment Info:" -ForegroundColor Yellow
Write-Host "Address: $ADDRESS"
Write-Host "Fee: $FEE microSTX"
Write-Host ""

Write-Host "📦 Deploying job-registry contract..." -ForegroundColor Cyan
stx deploy_contract contracts/job-registry.clar job-registry $FEE 0 $PRIVATE_KEY

Write-Host ""
Write-Host "📦 Deploying trophy-sbt contract..." -ForegroundColor Cyan  
stx deploy_contract contracts/trophy-sbt.clar trophy-sbt $FEE 1 $PRIVATE_KEY

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🔗 Check your contracts at:" -ForegroundColor Yellow
Write-Host "   - https://explorer.hiro.so/address/$ADDRESS?chain=testnet"
Write-Host "   - Contract calls: https://explorer.hiro.so/sandbox/contract-call?chain=testnet"
