import { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: ReactNode;
}

export function Card({ hover, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-[7px] p-6 transition-all duration-200 ${
        hover ? 'hover:shadow-md' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
