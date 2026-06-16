/**
 * Ignored files/directories when calculating the bundle's Merkle content hash.
 * node_modules is ignored to avoid hashing hundreds of megabytes of dependencies,
 * meaning node_modules integrity relies on lockfiles being in the hash.
 */
export const CONTENT_HASH_IGNORE_PATTERNS = [
  '.git',
  'node_modules',
  '.DS_Store',
  '.env',
  '.cvmb',
  '.mcpb',
];

/**
 * Ignored glob patterns when building the final ZIP archive.
 */
export const BUNDLE_IGNORE_PATTERNS = [
  '.git/**',
  'node_modules/.cache/**',
  '.DS_Store',
  '.env',
  '*.cvmb',
  '*.mcpb',
];

/**
 * Current version of the CVM/MCPB manifest specification.
 */
export const CVM_MANIFEST_VERSION = '0.3';
