interface DividerProps {
  className?: string;
}

export function Divider({ className = '' }: DividerProps) {
  return <hr className={`border-none h-px my-12 ${className}`} style={{ backgroundColor: 'rgba(229, 231, 235, 0.6)' }} />;
}
