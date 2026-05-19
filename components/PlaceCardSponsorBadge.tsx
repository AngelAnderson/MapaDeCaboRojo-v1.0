import React from 'react';
import { Place } from '../types';
import { getSponsorTier } from '../utils/sponsorTier';

interface Props {
  place: Place;
  size?: 'sm' | 'md';
}

const PlaceCardSponsorBadge: React.FC<Props> = ({ place, size = 'sm' }) => {
  const tier = getSponsorTier(place);
  if (tier.tier === 'free') return null;
  const sizeCls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${sizeCls} ${tier.badgeClass}`}
      title={tier.label}
      aria-label={tier.label}
    >
      <i className={`fa-solid fa-${tier.badgeIcon} text-[9px]`} aria-hidden="true"></i>
      <span>{tier.label}</span>
    </span>
  );
};

export default PlaceCardSponsorBadge;
