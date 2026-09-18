/** Workers の実行環境だけにある組み込みモジュール。型パッケージを入れずに必要な部分だけ宣言する。 */
declare module 'cloudflare:email' {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
  }
}
