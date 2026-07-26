/**
 * @jest-environment node
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
}

interface Manifest {
  icons: ManifestIcon[];
}

const publicDir = path.resolve(__dirname, '../../public');
const manifest = JSON.parse(
  readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'),
) as Manifest;

const readPngSize = (filePath: string): string => {
  const image = readFileSync(filePath);
  return `${image.readUInt32BE(16)}x${image.readUInt32BE(20)}`;
};

describe('PWA manifest', () => {
  test.each(['192x192', '512x512'])('declares an existing %s PNG icon', (size) => {
    const icon = manifest.icons.find(({ sizes }) => sizes === size);
    const filePath = path.join(publicDir, icon?.src.replace(/^\//, '') ?? '');

    expect(icon?.type).toBe('image/png');
    expect(existsSync(filePath)).toBe(true);
    expect(readPngSize(filePath)).toBe(size);
  });
});
