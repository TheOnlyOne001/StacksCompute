import { describe, it, expect } from 'vitest';
import { deriveChallenges, computeLabel, generateAllLabels } from '../utils/sampler.js';
import { buildMerkleFromLabels, proofForIndex, verify } from '../utils/merkle.js';
import fs from 'fs';
const testVectors = JSON.parse(fs.readFileSync(new URL('./vectors.json', import.meta.url), 'utf-8'));

describe('StackCompute Proof-of-Concept Verification', () => {
  const { seed, jobId, N, K } = testVectors.parameters;
  
  describe('Challenge Index Derivation', () => {
    it('should generate correct challenge indices matching test vectors', () => {
      const indices = deriveChallenges(seed, jobId, K, N);
      expect(indices).toEqual(testVectors.results.challengeIndices);
    });
    
    it('should allow duplicate indices as per spec', () => {
      const indices = deriveChallenges(seed, jobId, K, N);
      // Check that index 3 appears twice at positions 2 and 9
      expect(indices[2]).toBe(3);
      expect(indices[9]).toBe(3);
    });
  });
  
  describe('Label Computation', () => {
    it('should compute correct labels for all inputs', () => {
      const labels = generateAllLabels(seed, N);
      expect(labels).toEqual(testVectors.results.allLabels);
    });
    
    it('should compute correct label for specific index', () => {
      // Test first challenge index
      const index = testVectors.results.challengeIndices[0];
      const expectedLabel = testVectors.results.allLabels[index];
      const computedLabel = computeLabel(seed, index);
      expect(computedLabel).toBe(expectedLabel);
    });
  });
  
  describe('Merkle Tree Generation', () => {
    it('should generate correct Merkle root', () => {
      const labels = generateAllLabels(seed, N);
      const tree = buildMerkleFromLabels(labels);
      const rootHex = tree.root.hash.toString('hex');
      expect(rootHex).toBe(testVectors.results.merkleRoot);
    });
  });
  
  describe('Merkle Proof Verification', () => {
    it('should generate and verify proofs for all challenge indices', () => {
      const labels = generateAllLabels(seed, N);
      const tree = buildMerkleFromLabels(labels);
      const rootHex = tree.root.hash.toString('hex');
      
      // Test all sample proofs from vectors
      testVectors.results.sampleProofs.forEach(sample => {
        const proof = proofForIndex(tree, sample.index);
        
        // Verify proof structure matches
        expect(proof.length).toBe(sample.branch.length);
        proof.forEach((node, i) => {
          expect(node.dir).toBe(sample.branch[i].dir);
          expect(node.hash).toBe(sample.branch[i].hash);
        });
        
        // Verify proof validates
        const isValid = verify(rootHex, sample.index, sample.label, proof);
        expect(isValid).toBe(true);
      });
    });
    
    it('should fail verification with wrong label', () => {
      const rootHex = testVectors.results.merkleRoot;
      const sample = testVectors.results.sampleProofs[0];
      const wrongLabel = (sample.label + 1) % 10;
      
      const isValid = verify(rootHex, sample.index, wrongLabel, sample.branch);
      expect(isValid).toBe(false);
    });
    
    it('should fail verification with wrong index', () => {
      const rootHex = testVectors.results.merkleRoot;
      const sample = testVectors.results.sampleProofs[0];
      const wrongIndex = (sample.index + 1) % 100;
      
      const isValid = verify(rootHex, wrongIndex, sample.label, sample.branch);
      expect(isValid).toBe(false);
    });
  });
  
  describe('Contract Integration Readiness', () => {
    it('should format samples correctly for Clarity claim function', () => {
      const samples = testVectors.results.sampleProofs.map(sample => ({
        index: sample.index,
        label: sample.label,
        branch: sample.branch.map(node => ({
          dir: node.dir,
          hash: Buffer.from(node.hash, 'hex')
        }))
      }));
      
      // Verify structure
      expect(samples.length).toBe(10);
      samples.forEach(sample => {
        expect(typeof sample.index).toBe('number');
        expect(typeof sample.label).toBe('number');
        expect(Array.isArray(sample.branch)).toBe(true);
        sample.branch.forEach(node => {
          expect(typeof node.dir).toBe('boolean');
          expect(node.hash).toBeInstanceOf(Buffer);
          expect(node.hash.length).toBe(32);
        });
      });
    });
    
    it('should match exact hash calculations from test vectors', () => {
      // Verify leaf hash for index 72, label 2
      const { index, label } = testVectors.results.sampleProofs[0];
      const labels = generateAllLabels(seed, N);
      const tree = buildMerkleFromLabels(labels);
      
      // The leaf should hash correctly
      const leafNode = tree.leaves.find(leaf => leaf.index === index);
      expect(leafNode).toBeDefined();
      expect(leafNode.label).toBe(label);
      
      // Verify the complete proof path
      const proof = proofForIndex(tree, index);
      const rootHex = tree.root.hash.toString('hex');
      const isValid = verify(rootHex, index, label, proof);
      expect(isValid).toBe(true);
    });
  });
});

// Summary test
describe('Complete Flow Simulation', () => {
  it('should complete full provider flow successfully', () => {
    // 1. Provider generates all labels
    const labels = generateAllLabels(testVectors.parameters.seed, testVectors.parameters.N);
    
    // 2. Provider builds Merkle tree
    const tree = buildMerkleFromLabels(labels);
    const merkleRoot = tree.root.hash.toString('hex');
    
    // 3. Provider commits the root (would be on-chain)
    expect(merkleRoot).toBe(testVectors.results.merkleRoot);
    
    // 4. After seed reveal, derive challenge indices
    const challengeIndices = deriveChallenges(
      testVectors.parameters.seed,
      testVectors.parameters.jobId,
      testVectors.parameters.K,
      testVectors.parameters.N
    );
    
    // 5. Provider generates proofs for challenges
    const proofs = challengeIndices.map(index => ({
      index,
      label: labels[index],
      branch: proofForIndex(tree, index)
    }));
    
    // 6. Verify all proofs pass
    proofs.forEach(proof => {
      const isValid = verify(merkleRoot, proof.index, proof.label, proof.branch);
      expect(isValid).toBe(true);
    });
    
    console.log('✅ Complete flow verified successfully!');
    console.log(`   Merkle Root: 0x${merkleRoot}`);
    console.log(`   Challenge Indices: [${challengeIndices.join(', ')}]`);
    console.log(`   All ${proofs.length} proofs verified`);
  });
});