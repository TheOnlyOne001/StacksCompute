# 🚀 StackCompute Deployment with Leather Wallet

## ✅ **You're Ready to Deploy!**

Since you have Leather wallet with testnet tokens, you can deploy directly through the web interface - no command line needed!

## 🌐 **Method 1: Stacks Explorer (Easiest)**

### **Step 1: Deploy job-registry.clar**
1. **Open**: https://explorer.hiro.so/sandbox/deploy?chain=testnet
2. **Connect** your Leather wallet
3. **Contract Name**: `job-registry`
4. **Copy and paste** the entire contents of `contracts/job-registry.clar`
5. **Click Deploy** and confirm in Leather

### **Step 2: Deploy trophy-sbt.clar**
1. **Same process** as above
2. **Contract Name**: `trophy-sbt`
3. **Copy and paste** the entire contents of `contracts/trophy-sbt.clar`
4. **Click Deploy** and confirm in Leather

## 🏗️ **Method 2: Hiro Platform (Full IDE)**

### **Step 1: Create Project**
1. **Open**: https://platform.hiro.so
2. **Sign in** with Leather wallet
3. **Create new project**: "StackCompute"
4. **Upload** your contract files

### **Step 2: Deploy**
1. **Select testnet** environment
2. **Deploy both contracts**
3. **Test functions** directly in the IDE

## 📋 **Your Contract Files Ready for Copy/Paste**

### contracts/job-registry.clar
- **File**: `c:\Users\shaya\Downloads\stackcompute_context_pack\stackcompute\contracts\job-registry.clar`
- **Size**: ~500 lines
- **Dependencies**: None

### contracts/trophy-sbt.clar  
- **File**: `c:\Users\shaya\Downloads\stackcompute_context_pack\stackcompute\contracts\trophy-sbt.clar`
- **Size**: ~100 lines
- **Dependencies**: None

## 🧪 **After Deployment - Testing**

Once deployed, you can test your contracts:

### **Test Job Creation**
```clarity
(contract-call? .job-registry create-job 
  u100000000        ;; budget (100 STX)
  u10000000         ;; min-stake (10 STX)  
  u100              ;; commit-until block
  u200              ;; reveal-until block
  u100              ;; inputs-len
  0x1234567890      ;; seed-hash
  "https://stackcompute.com/job/1/meta.json"  ;; metadata-url
  true              ;; is-public
  true              ;; autopay
  u1000000          ;; settler-reward (1 STX)
)
```

### **Test Job Funding**
```clarity
(contract-call? .job-registry fund u1 u100000000)
```

## 🎯 **Deployment Checklist**

- [ ] Leather wallet connected to testnet
- [ ] Sufficient testnet STX balance
- [ ] Deploy job-registry contract
- [ ] Deploy trophy-sbt contract  
- [ ] Test basic functions
- [ ] Ready for mainnet!

## 💡 **Advantages of Web Deployment**

✅ **No command line needed**
✅ **Visual interface**  
✅ **Integrated testing**
✅ **Transaction history**
✅ **Easy contract interaction**

## 📍 **Your Next Steps**

1. **Choose your deployment method** (Stacks Explorer or Hiro Platform)
2. **Copy contract code** from your files
3. **Deploy to testnet** via web interface
4. **Test all functions** work correctly
5. **Deploy to mainnet** when ready

You're all set! Your contracts are ready for the blockchain! 🚀
