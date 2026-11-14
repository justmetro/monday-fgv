import { cn } from '../utils.js';
export const Skeleton = ({ className, ...p }) => <div className={cn('animate-pulse rounded-md bg-muted', className)} {...p} />;
