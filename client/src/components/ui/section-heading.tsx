interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({ title, subtitle, centered = true, className = '' }: SectionHeadingProps) {
  return (
    <div className={`${centered ? 'text-center' : ''} mb-12 ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h2>
      {subtitle && <p className="text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
    </div>
  );
}
