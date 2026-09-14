import type { SVGProps } from "react";

type Props = Omit<SVGProps<SVGSVGElement>, "size"> & { size?: number };

const TikTokIcon = ({ size = 16, fill: _fill, strokeWidth: _sw, ...props }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
    {...props}
    fill="currentColor"
  >

    <path d="M16.6 5.82A5.2 5.2 0 0 1 15.3 2h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12V8.75a5.9 5.9 0 0 0-.78-.05A5.7 5.7 0 1 0 15.3 14.4V8.2a8.2 8.2 0 0 0 4.7 1.47V6.6a5.2 5.2 0 0 1-3.4-.78Z" />
  </svg>
);

export default TikTokIcon;
