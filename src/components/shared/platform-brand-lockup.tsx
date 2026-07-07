import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export const DEEPBLUE_SMART_CONTROL_LOGO_PATH = '/assets/platform-brand/deepblue-smart-control-logo.png';
export const DEEPBLUE_SMART_CONTROL_LOGO_DARK_PATH = '/assets/platform-brand/deepblue-smart-control-logo-dark.png';
export const DEEPBLUE_SMART_CONTROL_LOGO_METADATA_PATH = '/assets/platform-brand/deepblue-smart-control-logo-meta.json';

export function PlatformBrandLockup({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="深蓝智控首页"
      className={cn('group flex min-w-0 flex-col items-start gap-1', className)}
      data-platform-brand-lockup="deepblue-smart-control"
      data-platform-brand-asset={DEEPBLUE_SMART_CONTROL_LOGO_PATH}
      data-platform-brand-dark-asset={DEEPBLUE_SMART_CONTROL_LOGO_DARK_PATH}
    >
      <span className="relative flex h-10 w-[120px] shrink-0 items-center sm:h-12 sm:w-[182px]">
        <Image
          src={DEEPBLUE_SMART_CONTROL_LOGO_PATH}
          alt="深蓝智控"
          width={1959}
          height={803}
          priority
          sizes="(max-width: 640px) 120px, 182px"
          className={cn(
            'h-full w-full object-contain object-left drop-shadow-[0_10px_22px_rgba(14,165,233,0.24)] transition dark:opacity-0 group-hover:drop-shadow-[0_12px_28px_rgba(14,165,233,0.32)]',
            imageClassName,
          )}
        />
        <Image
          src={DEEPBLUE_SMART_CONTROL_LOGO_DARK_PATH}
          alt=""
          aria-hidden="true"
          width={1959}
          height={803}
          sizes="(max-width: 640px) 120px, 182px"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-contain object-left opacity-0 drop-shadow-[0_12px_30px_rgba(56,189,248,0.46)] transition dark:opacity-100 dark:group-hover:drop-shadow-[0_14px_36px_rgba(56,189,248,0.58)]',
            imageClassName,
          )}
        />
      </span>
      <span className="min-w-0 text-left">
        <span className="block max-w-[120px] text-[10px] font-medium leading-tight text-subtle sm:max-w-[248px] sm:truncate sm:text-xs">
          基于学科垂类大模型的船舶智控教学平台
        </span>
      </span>
    </Link>
  );
}
