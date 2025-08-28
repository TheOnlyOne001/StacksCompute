import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';
import testVectors from '../vectors.json' assert { type: "json" };

Clarinet.test({
  name: "Happy path: create -> fund -> register -> commit -> reveal -> claim (autopay)",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const renter = accounts.get('wallet_1')!;
    const provider = accounts.get('wallet_2')!;
    
    // Test parameters from vectors
    const seedHex = testVectors.parameters.seed;
    const seedBuff = types.buff(Buffer.from(seedHex, 'hex'));
    const seedHash = types.buff(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex')); // sha256 of seed
    const merkleRoot = types.buff(Buffer.from(testVectors.results.merkleRoot, 'hex'));
    const jobId = 1;
    
    let block = chain.mineBlock([
      // 1. Create job
      Tx.contractCall('job-registry', 'create-job', [
        types.uint(100000000), // budget: 100 STX
        types.uint(10000000),  // min-stake: 10 STX
        types.uint(100),       // commit-until
        types.uint(200),       // reveal-until
        types.uint(100),       // inputs-len
        seedHash,              // seed-hash
        types.ascii("https://stackcompute.com/job/1/meta.json"),
        types.bool(true),      // is-public
        types.bool(true),      // autopay
        types.uint(1000000)    // settler-reward: 1 STX
      ], renter.address),
      
      // 2. Fund job
      Tx.contractCall('job-registry', 'fund', [
        types.uint(jobId),
        types.uint(100000000) // 100 STX
      ], renter.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok u1)');
    assertEquals(block.receipts[1].result, '(ok true)');
    
    // 3. Register worker
    block = chain.mineBlock([
      Tx.contractCall('job-registry', 'register-worker', [
        types.uint(jobId)
      ], provider.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // 4. Commit result
    block = chain.mineBlock([
      Tx.contractCall('job-registry', 'commit-result', [
        types.uint(jobId),
        merkleRoot
      ], provider.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Advance to after commit deadline
    chain.mineEmptyBlockUntil(101);
    
    // 5. Reveal seed
    block = chain.mineBlock([
      Tx.contractCall('job-registry', 'reveal-seed', [
        types.uint(jobId),
        seedBuff
      ], renter.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // 6. Claim with proof (autopay)
    const samples = testVectors.results.sampleProofs.map(sample => 
      types.tuple({
        'index': types.uint(sample.index),
        'label': types.uint(sample.label),
        'branch': types.list(sample.branch.map(node =>
          types.tuple({
            'dir': types.bool(node.dir),
            'hash': types.buff(Buffer.from(node.hash, 'hex'))
          })
        ))
      })
    );
    
    // Get initial balances
    const providerBalanceBefore = chain.getAssetsMaps().assets['STX'][provider.address];
    const contractBalanceBefore = chain.getAssetsMaps().assets['STX'][`${deployer.address}.job-registry`];
    
    block = chain.mineBlock([
      Tx.contractCall('job-registry', 'claim', [
        types.uint(jobId),
        types.list(samples)
      ], provider.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Verify balances changed (payout + stake refund)
    const providerBalanceAfter = chain.getAssetsMaps().assets['STX'][provider.address];
    const contractBalanceAfter = chain.getAssetsMaps().assets['STX'][`${deployer.address}.job-registry`];
    
    assertEquals(providerBalanceAfter, providerBalanceBefore + 100000000 + 10000000); // budget + stake
    assertEquals(contractBalanceAfter, contractBalanceBefore - 100000000 - 10000000);
    
    // Verify job is settled
    const job = chain.callReadOnlyFn('job-registry', 'get-job', [types.uint(jobId)], deployer.address);
    assertEquals(job.result.expectSome().settled, true);
  }
});

Clarinet.test({
  name: "Guard: Second claim reverts (already settled)",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const renter = accounts.get('wallet_1')!;
    const provider1 = accounts.get('wallet_2')!;
    const provider2 = accounts.get('wallet_3')!;
    
    // Setup: Create, fund, register both providers, commit, reveal
    const seedBuff = types.buff(Buffer.from(testVectors.parameters.seed, 'hex'));
    const seedHash = types.buff(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex'));
    const merkleRoot = types.buff(Buffer.from(testVectors.results.merkleRoot, 'hex'));
    const jobId = 1;
    
    chain.mineBlock([
      Tx.contractCall('job-registry', 'create-job', [
        types.uint(100000000), types.uint(10000000), types.uint(100), types.uint(200),
        types.uint(100), seedHash, types.ascii("test"), types.bool(true), types.bool(true), types.uint(0)
      ], renter.address),
      Tx.contractCall('job-registry', 'fund', [types.uint(jobId), types.uint(100000000)], renter.address),
      Tx.contractCall('job-registry', 'register-worker', [types.uint(jobId)], provider1.address),
      Tx.contractCall('job-registry', 'register-worker', [types.uint(jobId)], provider2.address),
      Tx.contractCall('job-registry', 'commit-result', [types.uint(jobId), merkleRoot], provider1.address),
      Tx.contractCall('job-registry', 'commit-result', [types.uint(jobId), merkleRoot], provider2.address)
    ]);
    
    chain.mineEmptyBlockUntil(101);
    
    chain.mineBlock([
      Tx.contractCall('job-registry', 'reveal-seed', [types.uint(jobId), seedBuff], renter.address)
    ]);
    
    // First claim succeeds
    const samples = testVectors.results.sampleProofs.map(sample => 
      types.tuple({
        'index': types.uint(sample.index),
        'label': types.uint(sample.label),
        'branch': types.list(sample.branch.map(node =>
          types.tuple({
            'dir': types.bool(node.dir),
            'hash': types.buff(Buffer.from(node.hash, 'hex'))
          })
        ))
      })
    );
    
    let block = chain.mineBlock([
      Tx.contractCall('job-registry', 'claim', [types.uint(jobId), types.list(samples)], provider1.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Second claim fails - already settled
    block = chain.mineBlock([
      Tx.contractCall('job-registry', 'claim', [types.uint(jobId), types.list(samples)], provider2.address)
    ]);
    
    block.receipts[0].result.expectErr().expectUint(106); // ERR-ALREADY-SETTLED
  }
});

Clarinet.test({
  name: "Guard: Claim before reveal fails",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const renter = accounts.get('wallet_1')!;
    const provider = accounts.get('wallet_2')!;
    
    const seedHash = types.buff(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex'));
    const merkleRoot = types.buff(Buffer.from(testVectors.results.merkleRoot, 'hex'));
    const jobId = 1;
    
    chain.mineBlock([
      Tx.contractCall('job-registry', 'create-job', [
        types.uint(100000000), types.uint(10000000), types.uint(100), types.uint(200),
        types.uint(100), seedHash, types.ascii("test"), types.bool(true), types.bool(true), types.uint(0)
      ], renter.address),
      Tx.contractCall('job-registry', 'fund', [types.uint(jobId), types.uint(100000000)], renter.address),
      Tx.contractCall('job-registry', 'register-worker', [types.uint(jobId)], provider.address),
      Tx.contractCall('job-registry', 'commit-result', [types.uint(jobId), merkleRoot], provider.address)
    ]);
    
    chain.mineEmptyBlockUntil(101);
    
    // Try to claim without reveal - should fail
    const samples = testVectors.results.sampleProofs.map(sample => 
      types.tuple({
        'index': types.uint(sample.index),
        'label': types.uint(sample.label),
        'branch': types.list(sample.branch.map(node =>
          types.tuple({
            'dir': types.bool(node.dir),
            'hash': types.buff(Buffer.from(node.hash, 'hex'))
          })
        ))
      })
    );
    
    const block = chain.mineBlock([
      Tx.contractCall('job-registry', 'claim', [types.uint(jobId), types.list(samples)], provider.address)
    ]);
    
    block.receipts[0].result.expectErr().expectUint(107); // ERR-NOT-REVEALED
  }
});

Clarinet.test({
  name: "Guard: Claim with wrong proof fails",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const renter = accounts.get('wallet_1')!;
    const provider = accounts.get('wallet_2')!;
    
    const seedBuff = types.buff(Buffer.from(testVectors.parameters.seed, 'hex'));
    const seedHash = types.buff(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex'));
    const merkleRoot = types.buff(Buffer.from(testVectors.results.merkleRoot, 'hex'));
    const jobId = 1;
    
    chain.mineBlock([
      Tx.contractCall('job-registry', 'create-job', [
        types.uint(100000000), types.uint(10000000), types.uint(100), types.uint(200),
        types.uint(100), seedHash, types.ascii("test"), types.bool(true), types.bool(true), types.uint(0)
      ], renter.address),
      Tx.contractCall('job-registry', 'fund', [types.uint(jobId), types.uint(100000000)], renter.address),
      Tx.contractCall('job-registry', 'register-worker', [types.uint(jobId)], provider.address),
      Tx.contractCall('job-registry', 'commit-result', [types.uint(jobId), merkleRoot], provider.address)
    ]);
    
    chain.mineEmptyBlockUntil(101);
    
    chain.mineBlock([
      Tx.contractCall('job-registry', 'reveal-seed', [types.uint(jobId), seedBuff], renter.address)
    ]);
    
    // Use samples with wrong label
    const wrongSamples = testVectors.results.sampleProofs.map(sample => 
      types.tuple({
        'index': types.uint(sample.index),
        'label': types.uint((sample.label + 1) % 10), // Wrong label!
        'branch': types.list(sample.branch.map(node =>
          types.tuple({
            'dir': types.bool(node.dir),
            'hash': types.buff(Buffer.from(node.hash, 'hex'))
          })
        ))
      })
    );
    
    const block = chain.mineBlock([
      Tx.contractCall('job-registry', 'claim', [types.uint(jobId), types.list(wrongSamples)], provider.address)
    ]);
    
    block.receipts[0].result.expectErr().expectUint(108); // ERR-INVALID-PROOF
  }
});

Clarinet.test({
  name: "Finalize after deadline refunds escrow",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const renter = accounts.get('wallet_1')!;
    const settler = accounts.get('wallet_3')!;
    
    const seedHash = types.buff(Buffer.from('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46', 'hex'));
    const jobId = 1;
    const settlerReward = 1000000; // 1 STX
    
    const renterBalanceBefore = chain.getAssetsMaps().assets['STX'][renter.address];
    
    chain.mineBlock([
      Tx.contractCall('job-registry', 'create-job', [
        types.uint(100000000), types.uint(10000000), types.uint(100), types.uint(200),
        types.uint(100), seedHash, types.ascii("test"), types.bool(true), types.bool(true), 
        types.uint(settlerReward)
      ], renter.address),
      Tx.contractCall('job-registry', 'fund', [types.uint(jobId), types.uint(100000000)], renter.address)
    ]);
    
    // Advance past reveal deadline
    chain.mineEmptyBlockUntil(201);
    
    // Finalize - should refund minus settler reward
    const block = chain.mineBlock([
      Tx.contractCall('job-registry', 'finalize', [types.uint(jobId)], settler.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Verify refund
    const renterBalanceAfter = chain.getAssetsMaps().assets['STX'][renter.address];
    const settlerBalanceAfter = chain.getAssetsMaps().assets['STX'][settler.address];
    
    assertEquals(renterBalanceAfter, renterBalanceBefore - settlerReward); // Got refund minus reward
    assertEquals(settlerBalanceAfter, settlerReward); // Got reward
    
    // Verify job is settled
    const job = chain.callReadOnlyFn('job-registry', 'get-job', [types.uint(jobId)], renter.address);
    assertEquals(job.result.expectSome().settled, true);
  }
});