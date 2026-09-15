import { clsx } from 'clsx';
import type { CollectionImage } from '@/lib/collections/core';

/** The first image on a page loads eagerly with high priority; later images wait for scrolling. */
export default function EntryImage({
  image,
  priority = false,
  className,
}: {
  image: CollectionImage;
  priority?: boolean;
  className?: string;
}) {
  return (
    <img
      className={clsx('entry-image', className)}
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
    />
  );
}
