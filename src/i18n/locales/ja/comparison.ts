/** Shared production fee and comparison assumptions; amounts come from prices.ts. */
export default {
  ours: '制作{price}円（買い切り）<br><span class="dim">保守契約なし・外部費込みの期間総額</span> <strong>{total}円</strong>',
  assumptions:
    '紬は保守契約なしで利用できます。紬への月額は0円。期間総額は制作費と外部費概算月{external}円で計算しています。ドメイン・サーバー等はお客様の直接契約・実費で、契約先や利用量により変わります。',
} as const;
