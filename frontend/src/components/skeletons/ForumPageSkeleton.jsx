import { Card, CardContent } from '@/components/ui/card.jsx';
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonHeading, 
  SkeletonButton, 
  SkeletonCard,
  SkeletonAvatar 
} from './Skeleton';

/**
 * Skeleton component for ForumPage loading state
 * Matches the structure of the forum discussions interface
 */
function ForumPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Skeleton */}
      <div className="mb-8">
        <SkeletonHeading level={1} className="w-72 mb-2" />
        <SkeletonText className="w-96" />
      </div>

      {/* Controls Card Skeleton */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Bar Skeleton */}
            <div className="relative flex-1 max-w-md">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            
            {/* Create Discussion Button Skeleton */}
            <SkeletonButton className="w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Forum Statistics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      {/* Discussion Categories Skeleton */}
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <DiscussionCategorySkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * Statistics card skeleton
 */
function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <Skeleton className="h-8 w-16 mx-auto mb-2" />
        <SkeletonText className="w-32 mx-auto h-3" />
      </CardContent>
    </Card>
  );
}

/**
 * Discussion category skeleton with discussion list
 */
function DiscussionCategorySkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        {/* Category Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-8 h-8 rounded" />
            <div>
              <SkeletonHeading level={3} className="w-48 mb-1" />
              <SkeletonText className="w-64 h-3" />
            </div>
          </div>
          <SkeletonText className="w-16 h-3" />
        </div>

        {/* Discussion List */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <DiscussionItemSkeleton key={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual discussion item skeleton
 */
function DiscussionItemSkeleton() {
  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
      {/* Author Avatar */}
      <SkeletonAvatar size="sm" />
      
      <div className="flex-1 min-w-0">
        {/* Discussion Title */}
        <SkeletonText className="w-3/4 mb-1" />
        
        {/* Discussion Meta */}
        <div className="flex items-center space-x-4 text-sm">
          <SkeletonText className="w-20 h-3" />
          <SkeletonText className="w-16 h-3" />
          <SkeletonText className="w-24 h-3" />
        </div>
      </div>
      
      {/* Discussion Stats */}
      <div className="text-right">
        <Skeleton className="w-8 h-6 mb-1" />
        <SkeletonText className="w-12 h-3" />
      </div>
    </div>
  );
}

/**
 * Compact discussion list skeleton (for search results)
 */
function CompactDiscussionListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SkeletonAvatar size="sm" />
              <div>
                <SkeletonText className="w-64 mb-1" />
                <SkeletonText className="w-32 h-3" />
              </div>
            </div>
            <div className="text-right">
              <SkeletonText className="w-16 h-3 mb-1" />
              <SkeletonText className="w-12 h-3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * Forum category header skeleton
 */
function CategoryHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-10 h-10 rounded" />
        <div>
          <SkeletonHeading level={2} className="w-40 mb-1" />
          <SkeletonText className="w-56 h-3" />
        </div>
      </div>
      <div className="text-right">
        <SkeletonText className="w-20 h-3 mb-1" />
        <SkeletonText className="w-16 h-3" />
      </div>
    </div>
  );
}

export default ForumPageSkeleton;
export { 
  StatCardSkeleton, 
  DiscussionCategorySkeleton, 
  DiscussionItemSkeleton,
  CompactDiscussionListSkeleton,
  CategoryHeaderSkeleton 
};
