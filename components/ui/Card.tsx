import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  glass?: boolean;
  interactive?: boolean;
  elevation?: 1 | 2 | 3 | 4;
}

const elev = { 1: 'shadow-e1', 2: 'shadow-e2', 3: 'shadow-e3', 4: 'shadow-e4' };

export const Card: React.FC<CardProps> = ({
  as: Tag = 'div', glass, interactive, elevation = 1, className = '', children, ...rest
}) => (
  <Tag
    className={`rounded-card ${glass ? 'glass' : 'surface'} ${elev[elevation]} ` +
      `${interactive ? 'tap cursor-pointer hover:shadow-e3 transition-shadow' : ''} ${className}`}
    {...(rest as any)}
  >
    {children}
  </Tag>
);

export default Card;
