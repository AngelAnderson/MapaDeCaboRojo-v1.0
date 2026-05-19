import React from 'react';
import { getFreshnessTier } from '../utils/freshness';

interface FreshnessBadgeProps {
  verified_at?: string | null;
  isVerified?: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  verified_at,
  isVerified,
  size = 'sm',
  showLabel = true,
}) => {
  const info = getFreshnessTier(verified_at, isVerified);
  if (info.tier === 'unverified' && !isVerified) return null;

  const sizeCls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  const icon =
    info.tier === 'fresh' ? 'circle-check'
    : info.tier === 'aging' ? 'clock'
    : info.tier === 'stale' ? 'triangle-exclamation'
    : 'circle-check';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${sizeCls} ${info.colorClass}`}
      title={info.label}
      aria-label={info.label}
    >
      <i className={`fa-solid fa-${icon} text-[9px]`} aria-hidden="true"></i>
      {showLabel && <span>{info.shortLabel}</span>}
    </span>
  );
};

export default FreshnessBadge;
