/** Build tools resolve paths from this module, never from the caller's directory. */
import { join } from 'node:path';
export const ROOT = join(import.meta.dirname, '..');
export const VERIFICATION_DIR = join(ROOT, '.artifacts', 'verification');
export const SCREENSHOTS_DIR = join(ROOT, '.artifacts', 'screenshots');

/**
 * ビルドが作る公開ファイル（`.gitignore` にあり、checkout 直後には無い）。
 * バックアップ・引渡し資料に入れてはいけない対象であり、文書はこれらを指してよい。
 */
export const GENERATED_PUBLIC = [
  'public/theme.css',
  'public/robots.txt',
  'public/sitemap.xml',
  'public/images/onokoro-hero.svg',
] as const;
