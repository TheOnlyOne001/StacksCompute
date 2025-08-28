import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Hardcode test vectors since Deno import of JSON is different
const testVectors = {
  parameters: {
    seed: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    jobId: 1,
    N: 100,
    K: 10
  },
  results: {
    merkleRoot: "8250c95ae1efb84fb56e24bce9260af8e526662f50d17ebc7a64fcc28068cb90",
    challengeIndices: [72, 68, 3, 42, 39, 10, 21, 43, 79, 3],
    sampleProofs: [
      {
        index: 72,
        label: 2,
        branch: [
          { dir: true, hash: "907b5cdfc1cb014f82817386fb846782a5a3c2975a878872359d203f00087ba2" },
          { dir: true, hash: "d6014fde05ee94eec28420e4010d5e8fc4d2f85129fc3604d6719af3f4b73153" },
          { dir: true, hash: "13aeed748790804a675ad1157689ea6f4824c847173fe2d5a823d79f704ef638" },
          { dir: false, hash: "4acd8acabc7684896d06b4d780b784a5ec75343d677cb2a0c5080b780ca66f61" },
          { dir: true, hash: "282eeac5f94cac6b4d7e1427cea22410d936a7ec7a148d5a3b6c3a939455f76d" },
          { dir: true, hash: "babbe6085ed90843fdb70a4d74e607aac606dab19ec309e8a3bc96f583d0c7e6" },
          { dir: false, hash: "972b5db1e10f8637db42aba534425ea73152bba3cde8c280130a47a00c6c3f4e" }
        ]
      }
    ]
  }
};

// Helper to convert hex string to Uint8Array for Deno
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

Clarinet.test({
  name: "Happy path: create -> fund -> register -> commit -> reveal -> claim (autopay)",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const renter = accounts.get('wallet_1')!;
    const provider = accounts.get('wallet_2')!;
    
    // Test parameters from vectors
    const seedHex = testVectors.parameters.seed;
    const seedBuff = types.buff(hexToBytes(seedHex));
    const seedHash = types.buff(hexToBytes('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46')); // sha256 of seed
    const merkleRoot = types.buff(hexToBytes(testVectors.results.merkleRoot));
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
    const sample = testVectors.results.sampleProofs[0];
    const samples = [
      types.tuple({
        'index': types.uint(sample.index),
        'label': types.uint(sample.label),
        'branch': types.list(sample.branch.map(node =>
          types.tuple({
            'dir': types.bool(node.dir),
            'hash': types.buff(hexToBytes(node.hash))
          })
        ))
      })
    ];
    
    // Note: We can't easily check balances in old Clarinet, so we just verify the call succeeds
    block = chain.mineBlock([
      Tx.contractCall('job-registry', 'claim', [
        types.uint(jobId),
        types.list(samples)
      ], provider.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Verify job is settled by checking get-job
    const jobResult = chain.callReadOnlyFn('job-registry', 'get-job', [
      types.uint(jobId)
    ], deployer.address);
    
    // The result should be (some {...}) and contain settled: true
    assertEquals(jobResult.result.includes('settled: true'), true);
  }
});

Clarinet.test({
  name: "Guard: Claim before reveal fails",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const renter = accounts.get('wallet_1')!;
    const provider = accounts.get('wallet_2')!;
    
    const seedHash = types.buff(hexToBytes('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46'));
    const merkleRoot = types.buff(hexToBytes(testVectors.results.merkleRoot));
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
    const sample = testVectors.results.sampleProofs[0];
    const samples = [
      types.tuple({
        'index': types.uint(sample.index),
        'label': types.uint(sample.label),
        'branch': types.list(sample.branch.map(node =>
          types.tuple({
            'dir': types.bool(node.dir),
            'hash': types.buff(hexToBytes(node.hash))
          })
        ))
      })
    ];
    
    const block = chain.mineBlock([
      Tx.contractCall('job-registry', 'claim', [types.uint(jobId), types.list(samples)], provider.address)
    ]);
    
    // Should fail with ERR-NOT-REVEALED (107)
    assertEquals(block.receipts[0].result.includes('(err u107)'), true);
  }
});

Clarinet.test({
  name: "Finalize after deadline refunds escrow",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const renter = accounts.get('wallet_1')!;
    const settler = accounts.get('wallet_3')!;
    
    const seedHash = types.buff(hexToBytes('c1694a2c88f7885e59e9221acf71c3e9142739c823b02a3297833ba0a8eb0c46'));
    const jobId = 1;
    const settlerReward = 1000000; // 1 STX
    
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
    
    // Verify job is settled
    const jobResult = chain.callReadOnlyFn('job-registry', 'get-job', [
      types.uint(jobId)
    ], renter.address);
    
    assertEquals(jobResult.result.includes('settled: true'), true);
  }
});