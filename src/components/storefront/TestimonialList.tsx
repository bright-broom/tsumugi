import { useMessages } from '@/components/ContentProvider';
import Note from '@/components/Note';
import { formatDisclosure, formatSource } from '@/i18n/storefront';
import type { PublishedTestimonial } from '@/lib/storefront/testimonials';

interface Props {
  /** publishableTestimonials() を通した一覧。許可の無い・撤回された声は含まれない */
  testimonials: readonly PublishedTestimonial[];
  /** 依頼表示の文中に入れる事業者名 */
  business: string;
}

/**
 * お客様の声の一覧（ADR 0059）。依頼・謝礼がある声には、本文より前に表示を必ず出す。
 * 表示を消す props は持たない。data-disclosure は表示の欠落を検査するための印。
 */
export default function TestimonialList({ testimonials, business }: Props) {
  const copy = useMessages('storefront').testimonials;
  const firstPhoto = testimonials.findIndex((testimonial) => testimonial.photo);
  return (
    <div className="cards">
      <div className="g g3">
        {testimonials.map((testimonial, index) => {
          const disclosure = formatDisclosure(testimonial, copy, business);
          const source = formatSource(testimonial.source, copy);
          return (
            <article
              className="card"
              id={`voice-${testimonial.id}`}
              key={testimonial.id}
              data-testimonial={testimonial.id}
            >
              {testimonial.disclosure && disclosure && (
                <div data-disclosure={testimonial.disclosure}>
                  <Note heading={copy.disclosureHeading} kind="warn">
                    <p>{disclosure}</p>
                  </Note>
                </div>
              )}
              {testimonial.body.split(/\n{2,}/).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {testimonial.photo && (
                <img
                  src={testimonial.photo.src}
                  alt={testimonial.photo.alt}
                  width={testimonial.photo.width}
                  height={testimonial.photo.height}
                  loading={index === firstPhoto ? undefined : 'lazy'}
                  decoding="async"
                />
              )}
              <p className="meta">
                {testimonial.name ?? copy.anonymous}
                <br />
                {testimonial.source.url ? <a href={testimonial.source.url}>{source}</a> : source}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
