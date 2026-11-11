import React, { useId } from 'react';

/* The Px monogram, drawn inline so it inherits the app's own rendering
   instead of loading a second copy of the icon file. */
const P_PATH =
  'M92 138H219C282 138 300 176 300 219C300 262 282 300 219 300H150V396H92Z ' +
  'M150 182H219C246 182 256 199 256 219C256 239 246 256 219 256H150Z';
const X_PATH =
  'M406 299L406 245L460 299L460 351L406 351L406 405L354 405L354 351L300 351L300 299L354 299L354 245Z';

interface BrandMarkProps {
  size?: number;
  /** Skips the dark plate when the mark sits on an already dark surface */
  bare?: boolean;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32, bare = false, className = '' }) => {
  const uid = useId().replace(/[:]/g, '');
  const body = `px-body-${uid}`;
  const gloss = `px-gloss-${uid}`;
  const plate = `px-plate-${uid}`;

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Pentix"
    >
      <defs>
        <linearGradient id={body} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#6EA8FF" />
          <stop offset="0.52" stopColor="#5B7CFF" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={plate} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#151821" />
          <stop offset="1" stopColor="#08090b" />
        </linearGradient>
      </defs>
      {!bare && <rect width="512" height="512" rx="112" fill={`url(#${plate})`} />}
      {!bare && (
        <rect
          x="1"
          y="1"
          width="510"
          height="510"
          rx="111"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.06"
        />
      )}
      <g fill={`url(#${body})`} fillRule="evenodd">
        <path d={P_PATH} />
        <path d={X_PATH} transform="rotate(45 380 325)" />
      </g>
      <g fill={`url(#${gloss})`} fillRule="evenodd">
        <path d={P_PATH} />
        <path d={X_PATH} transform="rotate(45 380 325)" />
      </g>
    </svg>
  );
};
