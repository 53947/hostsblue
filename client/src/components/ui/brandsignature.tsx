import { Link } from 'react-router-dom';

const brandData = {
  hostsblue: {
    image: '/hostsblue_logo_image_and_text_as_url.png',
    href: 'https://hostsblue.com',
    alt: 'hostsblue.com',
  },
  swipesblue: {
    image: '/swipesblue_logo_image_and_text_as_url.png',
    href: 'https://swipesblue.com',
    alt: 'swipesblue.com',
  },
  businessblueprint: {
    image: '/businessblueprint_logo_image_and_text_as_url.png',
    href: 'https://businessblueprint.io',
    alt: 'businessblueprint.io',
  },
  scansblue: {
    image: '/scansblue_logo_image_and_text_as_url.png',
    href: '#',
    alt: 'scansblue.com',
  },
  triadblue: {
    image: '/triadblue_logo_image_and_text_as_url.png',
    href: 'https://triadblue.com',
    alt: 'TRIADBLUE.COM',
  },
};

interface BrandsignatureProps {
  brand: keyof typeof brandData;
  /** Controls the rendered height in px. Width scales automatically. */
  size?: number;
  linkTo?: string;
  className?: string;
  /** Unused — kept for API compatibility */
  showTld?: boolean;
}

export function Brandsignature({
  brand,
  size = 16,
  linkTo,
  className = '',
}: BrandsignatureProps) {
  const d = brandData[brand];
  const href = linkTo || d.href;

  const img = (
    <img
      src={d.image}
      alt={d.alt}
      style={{ height: size, width: 'auto', display: 'inline-block' }}
    />
  );

  if (linkTo && (linkTo.startsWith('/') || linkTo === '/')) {
    return (
      <Link to={linkTo} className={`inline-flex items-center ${className}`}>
        {img}
      </Link>
    );
  }

  if (href && href !== '#') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center ${className}`}
      >
        {img}
      </a>
    );
  }

  return (
    <span className={`inline-flex items-center ${className}`}>
      {img}
    </span>
  );
}
