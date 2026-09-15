import type { PublishedStaff } from '@/lib/storefront/staff';

interface Props {
  /** publishedStaff() を通した一覧。非公開・退職・同意の無い人は含まれない */
  members: readonly PublishedStaff[];
  headingLevel?: 2 | 3;
}

/**
 * スタッフ紹介の一覧（ADR 0058）。紬の about と同じ見た目の部品を使い、写真は同意がある人だけに付く。
 * 各人に #staff-ID のアンカーを付け、個別の紹介へページ内で案内できるようにする。
 */
export default function StaffList({ members, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const firstPhoto = members.findIndex((member) => member.photo);
  return (
    <div className="cards member-cards">
      {members.map((member, index) => (
        <article className="card" id={`staff-${member.id}`} key={member.id}>
          {member.photo && (
            <img
              src={member.photo.src}
              alt={member.photo.alt}
              width={member.photo.width}
              height={member.photo.height}
              loading={index === firstPhoto ? undefined : 'lazy'}
              decoding="async"
            />
          )}
          <Heading className="member-name">{member.name}</Heading>
          <div className="meta">{member.role}</div>
          <div className="desc">{member.bio}</div>
        </article>
      ))}
    </div>
  );
}
