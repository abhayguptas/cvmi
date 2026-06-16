import { describe, it, expect } from 'vitest';
import {
  canonicalizeManifest,
  computeManifestId,
  signManifest,
  verifyManifestSignature,
} from './crypto.ts';
import type { CvmbManifest } from './cvm-manifest.ts';
import { generatePrivateKey } from '../utils/crypto.ts'; // assuming this exists and returns hex

describe('crypto', () => {
  const dummyManifest: CvmbManifest = {
    manifest_version: '0.3',
    name: 'test-server',
    version: '1.0.0',
    description: 'A test server',
    author: { name: 'Alice' },
    server: {
      type: 'node',
      transport: 'stdio',
      mcp_config: {
        command: 'node',
        args: ['index.js'],
      },
    },
    _meta: {
      'com.contextvm': {
        content_hash: 'sha256:dummyhash',
      },
    },
  };

  it('should canonicalize manifest consistently', () => {
    const json1 = canonicalizeManifest(dummyManifest);
    // Keys should be ordered alphabetically, no whitespace
    expect(json1).toContain('{"_meta":{"com.contextvm":{"content_hash":"sha256:dummyhash"}}');
    expect(json1).toContain('"author":{"name":"Alice"}');
  });

  it('should omit _sig when canonicalizing', () => {
    const signedManifest = {
      ...dummyManifest,
      _sig: {
        pubkey: 'dummy',
        id: 'dummy',
        signature: 'dummy',
        created_at: 12345,
      },
    };
    const json1 = canonicalizeManifest(dummyManifest);
    const json2 = canonicalizeManifest(signedManifest);
    expect(json1).toBe(json2);
  });

  it('should compute consistent manifest ID', () => {
    const id1 = computeManifestId(dummyManifest);
    const id2 = computeManifestId(dummyManifest);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('should successfully sign and verify a manifest', () => {
    const privKey = generatePrivateKey(); // generates a 64-char hex
    const signedManifest = { ...dummyManifest };

    signedManifest._sig = signManifest(signedManifest, privKey);

    expect(signedManifest._sig.pubkey).toMatch(/^[a-f0-9]{64}$/);
    expect(signedManifest._sig.signature).toMatch(/^[a-f0-9]{128}$/);

    // Verification should pass without throwing
    expect(verifyManifestSignature(signedManifest)).toBe(true);
  });

  it('should fail verification if manifest is tampered', () => {
    const privKey = generatePrivateKey();
    const signedManifest = { ...dummyManifest };
    signedManifest._sig = signManifest(signedManifest, privKey);

    // Tamper with the manifest
    signedManifest.version = '1.0.1';

    expect(() => verifyManifestSignature(signedManifest)).toThrow('Manifest ID mismatch');
  });

  it('should fail verification if signature is tampered', () => {
    const privKey = generatePrivateKey();
    const signedManifest = { ...dummyManifest };
    signedManifest._sig = signManifest(signedManifest, privKey);

    // Tamper with signature
    signedManifest._sig.signature = signedManifest._sig.signature.replace(/0/g, '1');

    expect(() => verifyManifestSignature(signedManifest)).toThrow('Invalid Schnorr signature');
  });
});
