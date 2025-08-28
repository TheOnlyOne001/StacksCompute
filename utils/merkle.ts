import { createHash } from 'crypto';

// Domain separation tags
const LEAF_TAG = 0x00;
const INNER_TAG = 0x01;

export interface MerkleNode {
  hash: Buffer;
  left?: MerkleNode;
  right?: MerkleNode;
  isLeaf: boolean;
  index?: number;
  label?: number;
}

export interface MerkleBranch {
  dir: boolean; // false = left, true = right
  hash: string; // hex string
}

export interface MerkleTree {
  root: MerkleNode;
  leaves: MerkleNode[];
}

/**
 * Create a leaf hash: sha256(0x00 || index[4] || label[1])
 */
function createLeafHash(index: number, label: number): Buffer {
  const hash = createHash('sha256');
  hash.update(Buffer.from([LEAF_TAG]));
  hash.update(Buffer.from(index.toString(16).padStart(8, '0'), 'hex')); // 4 bytes BE
  hash.update(Buffer.from([label])); // 1 byte
  return hash.digest();
}

/**
 * Create an inner node hash: sha256(0x01 || left || right)
 */
function createInnerHash(left: Buffer, right: Buffer): Buffer {
  const hash = createHash('sha256');
  hash.update(Buffer.from([INNER_TAG]));
  hash.update(left);
  hash.update(right);
  return hash.digest();
}

/**
 * Build a complete Merkle tree from leaves
 * @param leaves Array of {index, label} pairs
 * @returns MerkleTree with root and all nodes
 */
export function buildMerkle(leaves: Array<{index: number, label: number}>): MerkleTree {
  // Create leaf nodes
  const leafNodes: MerkleNode[] = leaves.map(({index, label}) => ({
    hash: createLeafHash(index, label),
    isLeaf: true,
    index,
    label
  }));

  // If no leaves, return empty tree
  if (leafNodes.length === 0) {
    throw new Error('Cannot build tree with no leaves');
  }

  // Build tree bottom-up
  let currentLevel = [...leafNodes];
  
  while (currentLevel.length > 1) {
    const nextLevel: MerkleNode[] = [];
    
    // Process pairs
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
      
      const parent: MerkleNode = {
        hash: createInnerHash(left.hash, right.hash),
        left,
        right,
        isLeaf: false
      };
      
      nextLevel.push(parent);
    }
    
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0],
    leaves: leafNodes
  };
}

/**
 * Generate Merkle proof for a specific index
 * @param tree The complete Merkle tree
 * @param targetIndex The index to prove
 * @returns Array of branch nodes with direction
 */
export function proofForIndex(tree: MerkleTree, targetIndex: number): MerkleBranch[] {
  const targetLeaf = tree.leaves.find(leaf => leaf.index === targetIndex);
  if (!targetLeaf) {
    throw new Error(`Index ${targetIndex} not found in tree`);
  }

  const proof: MerkleBranch[] = [];
  
  // Find path from leaf to root
  function findPath(node: MerkleNode, target: MerkleNode): boolean {
    if (node === target) {
      return true;
    }
    
    if (node.isLeaf) {
      return false;
    }
    
    // Check left subtree
    if (node.left && findPath(node.left, target)) {
      // Target is in left subtree, add right sibling to proof
      if (node.right) {
        proof.push({
          dir: true, // sibling is on the right
          hash: node.right.hash.toString('hex')
        });
      }
      return true;
    }
    
    // Check right subtree
    if (node.right && findPath(node.right, target)) {
      // Target is in right subtree, add left sibling to proof
      if (node.left) {
        proof.push({
          dir: false, // sibling is on the left
          hash: node.left.hash.toString('hex')
        });
      }
      return true;
    }
    
    return false;
  }
  
  findPath(tree.root, targetLeaf);
  return proof;
}

/**
 * Verify a Merkle proof
 * @param rootHex The expected root hash (hex string)
 * @param index The leaf index
 * @param label The leaf label
 * @param branch The proof branch
 * @returns true if proof is valid
 */
export function verify(rootHex: string, index: number, label: number, branch: MerkleBranch[]): boolean {
  // Start with leaf hash
  let currentHash = createLeafHash(index, label);
  
  // Walk up the branch
  for (const node of branch) {
    const siblingHash = Buffer.from(node.hash, 'hex');
    
    if (node.dir) {
      // Sibling is on the right
      currentHash = createInnerHash(currentHash, siblingHash);
    } else {
      // Sibling is on the left
      currentHash = createInnerHash(siblingHash, currentHash);
    }
  }
  
  // Compare with expected root
  return currentHash.toString('hex') === rootHex;
}

/**
 * Build a Merkle tree from all labels
 * @param labels Array of labels (indexed by position)
 * @returns MerkleTree
 */
export function buildMerkleFromLabels(labels: number[]): MerkleTree {
  const leaves = labels.map((label, index) => ({ index, label }));
  return buildMerkle(leaves);
}