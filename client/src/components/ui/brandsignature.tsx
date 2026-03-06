import { Link } from 'react-router-dom';

const brandData = {
  hostsblue: {
    first: 'hosts', firstColor: '#008060',
    second: 'blue', secondColor: '#0000FF',
    tld: '.com', tldColor: '#008060',
    icon: '/HostsBlue_Logo_Image.png',
    href: 'https://hostsblue.com',
    logoPosition: 'left' as const,
  },
  swipesblue: {
    first: 'swipes', firstColor: '#374151',
    second: 'blue', secondColor: '#0000FF',
    tld: '.com', tldColor: '#374151',
    icon: '/swipesblue_logo_image.png',
    href: 'https://swipesblue.com',
    logoPosition: 'left' as const,
  },
  businessblueprint: {
    first: 'business', firstColor: '#FF6B00',
    second: 'blueprint', secondColor: '#0000FF',
    tld: '.io', tldColor: '#FF6B00',
    icon: '/businessblueprint_logo_image.png',
    href: 'https://businessblueprint.io',
    logoPosition: 'left' as const,
  },
  scansblue: {
    first: 'scans', firstColor: '#A00028',
    second: 'blue', secondColor: '#0000FF',
    tld: '.com', tldColor: '#A00028',
    icon: '/scansblue_logo_image.png',
    href: '#',
    logoPosition: 'left' as const,
  },
  triadblue: {
    first: 'TRIAD', firstColor: '#1844A6',
    second: 'BLUE', secondColor: '#1844A6',
    tld: '.COM', tldColor: '#1844A6',
    icon: '/triadblue_logo_image.png',
    href: 'https://triadblue.com',
    logoPosition: 'middle' as const,
  },
};

interface BrandsignatureProps {
  brand: keyof typeof brandData;
  showTld?: boolean;
  size?: number;
  linkTo?: string;
  className?: string;
}

function BrandText({ brand, showTld, size }: { brand: keyof typeof brandData; showTld: boolean; size: number }) {
  const d = brandData[brand];
  const logoSize = size * 1.15;
  const logoBoxWidth = size * 1.6;
  const logoGap = size * 0.3;
  const middleGap = size * 0.2;
  const isTriadblue = brand === 'triadblue';
  const firstFont = "'Archivo Semi Expanded', sans-serif";
  const secondFont = "'Archivo Narrow', sans-serif";
  const whiteGlow = 'drop-shadow(0px 0px 100px rgba(255, 255, 255, 1))';

  const renderFirstWord = (color: string) => {
    if (isTriadblue) {
      return (
        <span style={{ fontFamily: firstFont, fontWeight: 800, color, fontSize: size }}>
          <span style={{ fontSize: size * 1.25 }}>T</span>RIAD
        </span>
      );
    }
    return <span style={{ fontFamily: firstFont, fontWeight: 800, color, fontSize: size }}>{d.first}</span>;
  };

  const renderSecondWord = (color: string) => {
    if (isTriadblue) {
      return (
        <span style={{ fontFamily: secondFont, fontWeight: 800, color, fontSize: size }}>
          <span style={{ fontSize: size * 1.25 }}>B</span>LUE
        </span>
      );
    }
    return <span style={{ fontFamily: secondFont, fontWeight: 800, color, fontSize: size }}>{d.second}</span>;
  };

  const renderTld = (color: string) => {
    if (!showTld) return null;
    return <span style={{ fontFamily: secondFont, fontWeight: 800, color, fontSize: size }}>{d.tld}</span>;
  };

  const renderLogo = () => (
    <img
      src={d.icon}
      alt=""
      style={{ height: logoSize, width: 'auto', filter: whiteGlow }}
      className="inline-block"
    />
  );

  const renderLogoBox = (visible: boolean) => (
    <span style={{
      width: logoBoxWidth,
      marginRight: logoGap,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      opacity: visible ? 1 : 0,
    }}>
      {visible ? renderLogo() : (
        <img src={d.icon} alt="" style={{ height: logoSize, width: 'auto' }} className="inline-block" />
      )}
    </span>
  );

  const renderMiddleLogo = (visible: boolean) => (
    <span style={{
      margin: `0 ${middleGap}px`,
      display: 'inline-flex',
      alignItems: 'center',
      opacity: visible ? 1 : 0,
    }}>
      {visible ? renderLogo() : (
        <img src={d.icon} alt="" style={{ height: logoSize, width: 'auto' }} className="inline-block" />
      )}
    </span>
  );

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }} className="brandsignature-wrapper">
      {/* Layer 2: Black accent (behind) */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0.5,
          left: 0.5,
          display: 'inline-flex',
          alignItems: 'center',
          textShadow: '0px 100px 100px rgba(255, 255, 255, 1)',
          pointerEvents: 'none',
        }}
      >
        {d.logoPosition === 'left' && renderLogoBox(false)}
        {renderFirstWord('#09080E')}
        {d.logoPosition === 'middle' && renderMiddleLogo(false)}
        {renderSecondWord('#09080E')}
        {renderTld('#09080E')}
      </span>

      {/* Layer 1: Colored text (top) */}
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          textShadow: '0px -100px 100px rgba(255, 255, 255, 1)',
        }}
      >
        {d.logoPosition === 'left' && renderLogoBox(true)}
        {renderFirstWord(d.firstColor)}
        {d.logoPosition === 'middle' && renderMiddleLogo(true)}
        {renderSecondWord(d.secondColor)}
        {renderTld(d.tldColor)}
      </span>
    </span>
  );
}

export function Brandsignature({ brand, showTld = true, size = 16, linkTo, className = '' }: BrandsignatureProps) {
  const d = brandData[brand];
  const href = linkTo || d.href;
  const content = <BrandText brand={brand} showTld={showTld} size={size} />;

  if (linkTo && (linkTo.startsWith('/') || linkTo === '/')) {
    return <Link to={linkTo} className={`inline-flex items-center ${className}`}>{content}</Link>;
  }

  if (href && href !== '#') {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center ${className}`}>
        {content}
      </a>
    );
  }

  return <span className={`inline-flex items-center ${className}`}>{content}</span>;
}
