import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: string;
}

/** Shimmering placeholder. Pass width/height via className. */
export const Skeleton: React.FC<SkeletonProps> = ({ rounded = 'rounded-md', className = '', ...rest }) => (
  <div aria-hidden className={`skeleton ${rounded} ${className}`} {...rest} />
);

/** A card-shaped skeleton for list/place loading states. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`surface rounded-card p-3 flex gap-3 ${className}`}>
    <Skeleton className="w-16 h-16 shrink-0" rounded="rounded-lg" />
    <div className="flex-1 space-y-2 py-1">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
);

export default Skeleton;
