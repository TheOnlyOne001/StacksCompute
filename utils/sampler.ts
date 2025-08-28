import { createHash } from 'crypto';

/**
 * Derives challenge indices for a job
 * @param seedHex - The revealed seed as hex string (without 0x prefix)
 * @param jobId - The job ID
 * @param K - Number of samples to generate
 * @param N - Total number of inputs (inputs-len)
 * @returns Array of challenge indices
 */
export function deriveChallenges(seedHex: string, jobId: number, K: number, N: number): number[] {
  const indices: number[] = [];
  const seedBuffer = Buffer.from(seedHex, 'hex');
  
  for (let k = 0; k < K; k++) {
    // Construct: seed || jobId || k
    const hash = createHash('sha256');
    hash.update(seedBuffer);
    hash.update(Buffer.from(jobId.toString(16).padStart(8, '0'), 'hex')); // 4 bytes BE
    hash.update(Buffer.from(k.toString(16).padStart(8, '0'), 'hex')); // 4 bytes BE
    
    const hashResult = hash.digest();
    
    // Convert hash to big integer and mod by N
    let value = BigInt(0);
    for (let i = 0; i < hashResult.length; i++) {
      value = (value << 8n) | BigInt(hashResult[i]);
    }
    
    const index = Number(value % BigInt(N));
    indices.push(index);
  }
  
  return indices;
}

/**
 * Compute label for demo task: sha256(seed || i) mod 10
 * @param seedHex - The revealed seed as hex string
 * @param index - The input index
 * @returns The computed label (0-9)
 */
export function computeLabel(seedHex: string, index: number): number {
  const seedBuffer = Buffer.from(seedHex, 'hex');
  const hash = createHash('sha256');
  hash.update(seedBuffer);
  hash.update(Buffer.from(index.toString(16).padStart(8, '0'), 'hex')); // 4 bytes BE
  
  const hashResult = hash.digest();
  
  // Convert first few bytes to unsigned number and mod by 10
  let value = 0;
  for (let i = 0; i < 4; i++) {
    value = (value << 8) | hashResult[i];
  }
  
  // Ensure positive result by using >>> 0 (unsigned right shift)
  return (value >>> 0) % 10;
}

/**
 * Generate all labels for the demo task
 * @param seedHex - The revealed seed as hex string
 * @param N - Total number of inputs
 * @returns Array of all computed labels
 */
export function generateAllLabels(seedHex: string, N: number): number[] {
  const labels: number[] = [];
  
  for (let i = 0; i < N; i++) {
    labels.push(computeLabel(seedHex, i));
  }
  
  return labels;
}