import canonicalize from 'canonicalize';
import { createHash } from 'crypto';
import { getPublicKey } from 'nostr-tools';
import { schnorr } from '@noble/curves/secp256k1.js';
import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import type { CvmbManifest } from './cvm-manifest.ts';
import { CONTENT_HASH_IGNORE_PATTERNS } from './constants.ts';

/**
 * Canonicalizes a manifest object according to RFC 8785.
 * If the manifest contains a `_sig` field, it is removed before canonicalization.
 */
export function canonicalizeManifest(manifest: CvmbManifest): string {
  // Create a copy without the _sig field
  const { _sig, ...manifestWithoutSig } = manifest;
  const canonical = canonicalize(manifestWithoutSig);
  if (!canonical) {
    throw new Error('Failed to canonicalize manifest');
  }
  return canonical;
}

/**
 * Computes the SHA-256 ID of the canonicalized manifest.
 */
export function computeManifestId(manifest: CvmbManifest): string {
  const canonical = canonicalizeManifest(manifest);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Signs a manifest using a Nostr private key (hex format).
 * Returns the complete `_sig` object to be injected into the manifest.
 */
export function signManifest(manifest: CvmbManifest, privateKeyHex: string) {
  const id = computeManifestId(manifest);

  // Convert hex strings to Uint8Arrays for @noble/curves
  const msgBytes = Uint8Array.from(Buffer.from(id, 'hex'));
  const privBytes = Uint8Array.from(Buffer.from(privateKeyHex, 'hex'));

  const signature = schnorr.sign(msgBytes, privBytes);
  const pubkey = getPublicKey(Uint8Array.from(Buffer.from(privateKeyHex, 'hex')));

  // @noble/curves schnorr.sign returns a Uint8Array, we need hex
  const signatureHex = Buffer.from(signature).toString('hex');

  return {
    pubkey,
    id,
    signature: signatureHex,
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Verifies the `_sig` block of a manifest.
 * Throws an error if the signature is missing or invalid.
 */
export function verifyManifestSignature(manifest: CvmbManifest): boolean {
  if (!manifest._sig) {
    throw new Error('Manifest is not signed');
  }

  const expectedId = computeManifestId(manifest);
  if (manifest._sig.id !== expectedId) {
    throw new Error('Manifest ID mismatch. The manifest has been modified after signing.');
  }

  const sigBytes = Uint8Array.from(Buffer.from(manifest._sig.signature, 'hex'));
  const msgBytes = Uint8Array.from(Buffer.from(manifest._sig.id, 'hex'));
  const pubBytes = Uint8Array.from(Buffer.from(manifest._sig.pubkey, 'hex'));

  const isValid = schnorr.verify(sigBytes, msgBytes, pubBytes);

  if (!isValid) {
    throw new Error('Invalid Schnorr signature');
  }

  return true;
}

/**
 * Computes a Merkle-style hash over a directory's contents.
 * 1. Hashes each file's contents (excluding manifest.json and ignored patterns).
 * 2. Sorts paths alphabetically.
 * 3. Concatenates path:hash\n and hashes the result.
 *
 * Note: node_modules is ignored to avoid hashing hundreds of megabytes of dependencies.
 * Therefore, node_modules integrity relies on lockfiles (package-lock.json, etc.) being in the hash.
 */
export async function computeDirectoryContentHash(
  dir: string,
  ignoreList: string[] = CONTENT_HASH_IGNORE_PATTERNS
): Promise<string> {
  const allFiles = await getFilesRecursive(dir);

  // Filter out manifest and ignored patterns
  const filteredFiles = allFiles.filter((file) => {
    const relPath = relative(dir, file).replace(/\\/g, '/');
    if (relPath === 'manifest.json') return false;
    if (relPath.endsWith('.cvmb') || relPath.endsWith('.mcpb')) return false;

    // Path-segment-aware ignore logic
    const segments = relPath.split(/[/\\]/);
    for (const ignore of ignoreList) {
      if (segments.includes(ignore)) return false;
    }
    return true;
  });

  const fileHashes: Array<{ path: string; hash: string }> = [];

  for (const file of filteredFiles) {
    const content = await readFile(file);
    const hash = createHash('sha256').update(content).digest('hex');
    const relPath = relative(dir, file).replace(/\\/g, '/'); // Normalize path separators
    fileHashes.push({ path: relPath, hash });
  }

  // Sort alphabetically by path
  fileHashes.sort((a, b) => a.path.localeCompare(b.path));

  // Concatenate path:hash\n
  const manifestContent = fileHashes.map((f) => `${f.path}:${f.hash}`).join('\n');

  return 'sha256:' + createHash('sha256').update(manifestContent).digest('hex');
}

/**
 * Helper to recursively get all files in a directory.
 */
async function getFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const res = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getFilesRecursive(res)));
    } else {
      files.push(res);
    }
  }

  return files;
}
