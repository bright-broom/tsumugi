import { questions } from '@/i18n/locales/ja/questions';

export default {
  title: 'よくあるご質問｜料金・解約・所有権・補助金について｜{cBRANDT}',
  desc: '料金、解約したらサイトはどうなるか、ソースコードは本当にもらえるのか、',
  desc2: '補助金は通るのか。お電話の前に確かめたいことへの答えをまとめています。',
  eyebrow: 'よくあるご質問',
  heading: 'お問い合わせの前に',
  lede: 'お電話の前に確かめたいことを集めました。ここに無いことは、<strong>そのままお電話でお聞きください。</strong>',
  heading2: '答えが見つからなかった方へ',
  lede2: 'ここに無いことは、そのままお聞きください。{cRESPONSEPROMISE}にご返信します。',
  primary: 'フォームで相談する',
  indexLabel: '質問のカテゴリ',
  groups: [
    {
      id: 'pricing',
      title: 'お金のこと',
      icon: 'calculator',
      entries: [
        questions['monthly-cost'],
        questions['initial-cost'],
        questions['single-page'],
        questions['cost-comparison'],
        questions['industry-price'],
        questions['extra-work'],
        questions['payment'],
      ],
    },
    {
      id: 'ownership',
      title: '所有と解約のこと',
      icon: 'key',
      entries: [
        questions['cancellation'],
        questions['transfer'],
        questions['support-term'],
        questions['source-code'],
        questions['migration'],
        questions['business-closure'],
      ],
    },
    {
      id: 'delivery',
      title: '作るもののこと',
      icon: 'code-xml',
      entries: [
        questions['specification'],
        questions['self-updates'],
        questions['photography'],
        questions['writing'],
        questions['mobile'],
      ],
    },
    {
      id: 'growth',
      title: '集客のこと',
      icon: 'trending-down',
      entries: [
        questions['search-ranking'],
        questions['acquisition'],
        questions['portals'],
        questions['advertising'],
        questions['ai-search'],
      ],
    },
    {
      id: 'subsidy',
      title: '補助金のこと',
      icon: 'hand-coins',
      entries: [
        questions['subsidy-approval'],
        questions['subsidy-application'],
        questions['subsidy-payment'],
      ],
    },
    {
      id: 'company',
      title: 'そのほか',
      icon: 'users',
      entries: [
        questions['area'],
        questions['team'],
        questions['case-studies'],
        questions['consultation'],
      ],
    },
  ],
} as const;
