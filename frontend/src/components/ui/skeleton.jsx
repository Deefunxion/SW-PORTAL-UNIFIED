import { cn } from '@/lib/utils';

/**
 * Base Skeleton component with shimmer animation
 * Provides the foundation for all skeleton loading states
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]",
        "animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

/**
 * Text skeleton for single lines of text
 */
function SkeletonText({ className, width = "100%", ...props }) {
  return (
    <Skeleton
      className={cn("h-4 rounded", className)}
      style={{ width }}
      {...props}
    />
  );
}

/**
 * Heading skeleton for titles and headers
 */
function SkeletonHeading({ className, level = 1, ...props }) {
  const heights = {
    1: "h-8",
    2: "h-7", 
    3: "h-6",
    4: "h-5"
  };
  
  return (
    <Skeleton
      className={cn(heights[level] || "h-6", "rounded", className)}
      {...props}
    />
  );
}

/**
 * Avatar skeleton for user profile pictures
 */
function SkeletonAvatar({ className, size = "md", ...props }) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };
  
  return (
    <Skeleton
      className={cn(sizes[size], "rounded-full", className)}
      {...props}
    />
  );
}

/**
 * Button skeleton for action buttons
 */
function SkeletonButton({ className, variant = "default", ...props }) {
  const variants = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 py-1",
    lg: "h-12 px-6 py-3"
  };
  
  return (
    <Skeleton
      className={cn(variants[variant], "rounded-md", className)}
      {...props}
    />
  );
}

/**
 * Card skeleton for content cards
 */
function SkeletonCard({ className, children, ...props }) {
  return (
    <div className={cn("rounded-lg border border-gray-200 p-4 space-y-3", className)} {...props}>
      {children}
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonHeading,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard
};
