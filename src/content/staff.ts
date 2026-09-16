import { defineStaff } from '@/lib/storefront/staff';

/**
 * 顧客サイトのスタッフ紹介（ADR 0048）。紬の about は content/config.ts の MEMBERS を表示するので空。
 * 氏名・役割・紹介文はカタログ（i18n/locales/ja/）に置いて参照し、同意の記録は recordRef で示す。
 */
export const STAFF = defineStaff([]);
