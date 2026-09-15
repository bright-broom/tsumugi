import type { Block } from '@/lib/collections/core';
import EntryImage from '@/components/collections/EntryImage';

/** Structured body content. Text is escaped by React; no document can inject markup. */
export default function Blocks({
  blocks,
  priorityImage = false,
}: {
  blocks: readonly Block[];
  /** Set when no image precedes the body, so its first image is the page's lead image. */
  priorityImage?: boolean;
}) {
  const lead = priorityImage ? blocks.findIndex((block) => block.type === 'image') : -1;
  return (
    <div className="entry-body">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return <h2 key={index}>{block.text}</h2>;
          case 'paragraph':
            return <p key={index}>{block.text}</p>;
          case 'list':
            return (
              <ul key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            );
          case 'image':
            return (
              <figure key={index}>
                <EntryImage image={block.image} priority={index === lead} />
                {block.caption && <figcaption>{block.caption}</figcaption>}
              </figure>
            );
          default: {
            const exhaustive: never = block;
            throw new Error(`Unknown block: ${JSON.stringify(exhaustive)}`);
          }
        }
      })}
    </div>
  );
}
