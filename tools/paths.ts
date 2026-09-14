/** Build tools resolve paths from this module, never from the caller's directory. */
import { join } from 'node:path';
export const ROOT = join(import.meta.dirname, '..');
export const VERIFICATION_DIR = join(ROOT, '.artifacts', 'verification');
export const SCREENSHOTS_DIR = join(ROOT, '.artifacts', 'screenshots');
