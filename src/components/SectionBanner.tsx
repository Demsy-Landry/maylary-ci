import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function SectionBanner({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  image,
}: {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={ctaHref}
      className="group relative block overflow-hidden rounded-lg border bg-secondary"
    >
      <div className="aspect-[16/9] w-full sm:aspect-[3/1]">
        {!imgError ? (
          <img
            src={image}
            alt=""
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-secondary" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white text-balance sm:text-2xl">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 max-w-md text-sm text-white/85 text-balance">{subtitle}</p>
        )}
        <span className="mt-3 inline-flex items-center text-sm font-semibold text-white underline underline-offset-4 decoration-white/50 group-hover:decoration-white">
          {ctaLabel} →
        </span>
      </div>
    </Link>
  );
}
