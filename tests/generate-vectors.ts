import { deriveChallenges, generateAllLabels, computeLabel } from '../utils/sampler';
import { buildMerkleFromLabels, proofForIndex, verify } from '../utils/merkle';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Test parameters
const SEED_HEX = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const JOB_ID = 1;
const N = 100;  // inputs-len
const K = 10;   // number of samples

console.log('🔐 Generating test vectors...\n');

// 1. Generate challenge indices
console.log('1️⃣ Challenge Indices:');
const indices = deriveChallenges(SEED_HEX, JOB_ID, K, N);
console.log(`   Seed: 0x${SEED_HEX}`);
console.log(`   JobId: ${JOB_ID}`);
console.log(`   K: ${K}, N: ${N}`);
console.log(`   Indices: [${indices.join(', ')}]\n`);

// 2. Generate all labels for demo task
console.log('2️⃣ Computing Labels:');
const allLabels = generateAllLabels(SEED_HEX, N);
console.log(`   First 10 labels: [${allLabels.slice(0, 10).join(', ')}]`);
console.log(`   Challenge labels: ${indices.map(i => `[${i}]=${allLabels[i]}`).join(', ')}\n`);

// 3. Build Merkle tree
console.log('3️⃣ Building Merkle Tree:');
const tree = buildMerkleFromLabels(allLabels);
const rootHex = tree.root.hash.toString('hex');
console.log(`   Root: 0x${rootHex}`);
console.log(`   Tree depth: ${Math.ceil(Math.log2(N))}\n`);

// 4. Generate proof for first challenge index
const proofIndex = indices[0];
console.log(`4️⃣ Generating Proof for Index ${proofIndex}:`);
const proof = proofForIndex(tree, proofIndex);
console.log(`   Label: ${allLabels[proofIndex]}`);
console.log(`   Proof length: ${proof.length} nodes`);
proof.forEach((node, i) => {
  console.log(`   [${i}] ${node.dir ? 'RIGHT' : 'LEFT'}: 0x${node.hash}`);
});

// 5. Verify proof
console.log('\n5️⃣ Verifying Proof:');
const isValid = verify(rootHex, proofIndex, allLabels[proofIndex], proof);
console.log(`   Valid: ${isValid ? '✅' : '❌'}`);

// 6. Generate sample proofs for all challenge indices
const samples = indices.map(index => {
  const label = allLabels[index];
  const branch = proofForIndex(tree, index);
  return {
    index,
    label,
    branch: branch.map(b => ({
      dir: b.dir,
      hash: b.hash
    }))
  };
});

// Create test vectors object
const vectors = {
  metadata: {
    generated: new Date().toISOString(),
    description: 'StackCompute test vectors for challenge derivation and Merkle proofs'
  },
  parameters: {
    seed: SEED_HEX,
    jobId: JOB_ID,
    N,
    K
  },
  results: {
    challengeIndices: indices,
    allLabels,
    merkleRoot: rootHex,
    sampleProofs: samples
  },
  verification: {
    leafFormat: 'sha256(0x00 || index[4 bytes BE] || label[1 byte])',
    innerFormat: 'sha256(0x01 || left || right)',
    challengeFormula: 'sha256(seed || jobId || k) mod N'
  }
};

// Save to file
const outputPath = './tests/vectors.json';
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(vectors, null, 2));

console.log(`\n✅ Test vectors saved to: ${outputPath}`);

// Display summary for Clarity contract implementation
console.log('\n📋 Summary for Contract Implementation:');
console.log('====================================');
console.log(`Merkle Root: 0x${rootHex}`);
console.log(`First Sample: index=${samples[0].index}, label=${samples[0].label}`);
console.log(`Branch Length: ${samples[0].branch.length} nodes`);
console.log('\nUse these values in your Clarinet tests to ensure the contract');
console.log('computes the same challenge indices and validates the same proofs.');