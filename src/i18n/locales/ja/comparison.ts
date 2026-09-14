/** Shared production fee and comparison assumptions; amounts come from prices.ts. */
export default {
  ours: '制作{price}円<br><span class="dim">期間総額</span> <strong>{total}円</strong>',
  assumptions:
    '紬の総額には、保守「守る」月{care}円と外部費概算月{external}円を含みます。支援は任意。外部費は契約・利用量で変わり、支援終了後も必要です。',
} as const;
