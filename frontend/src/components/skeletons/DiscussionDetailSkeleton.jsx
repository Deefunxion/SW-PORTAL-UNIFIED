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
 * Skeleton component for DiscussionDetail loading state
 * Matches the structure of individual discussion threads
 */
function DiscussionDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb Skeleton */}
      <div className="mb-6">
        <div className="flex items-center space-x-2">
          <SkeletonText className="w-16 h-3" />
          <SkeletonText className="w-4 h-3" />
          <SkeletonText className="w-20 h-3" />
          <SkeletonText className="w-4 h-3" />
          <SkeletonText className="w-32 h-3" />
        </div>
      </div>

      {/* Discussion Header Skeleton */}
      <DiscussionHeaderSkeleton />

      {/* Discussion Content Skeleton */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-3">
            <SkeletonText className="w-full" />
            <SkeletonText className="w-5/6" />
            <SkeletonText className="w-4/5" />
            <SkeletonText className="w-3/4" />
          </div>
        </CardContent>
      </Card>

      {/* Posts List Skeleton */}
      <div className="space-y-4 mb-8">
        <SkeletonHeading level={3} className="w-32" />
        {Array.from({ length: 5 }).map((_, index) => (
          <PostSkeleton key={index} />
        ))}
      </div>

      {/* New Post Form Skeleton */}
      <NewPostFormSkeleton />
    </div>
  );
}

/**
 * Discussion header skeleton with title, author, and metadata
 */
function DiscussionHeaderSkeleton() {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Discussion Title */}
            <SkeletonHeading level={1} className="w-3/4 mb-4" />
            
            {/* Author and Meta Info */}
            <div className="flex items-center space-x-4">
              <SkeletonAvatar size="sm" />
              <div>
                <SkeletonText className="w-24 mb-1" />
                <SkeletonText className="w-32 h-3" />
              </div>
            </div>
          </div>
          
          {/* Discussion Actions */}
          <div className="flex space-x-2">
            <SkeletonButton variant="sm" className="w-20" />
            <SkeletonButton variant="sm" className="w-16" />
          </div>
        </div>
        
        {/* Discussion Stats */}
        <div className="flex items-center space-x-6 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <Skeleton className="w-4 h-4 rounded" />
            <SkeletonText className="w-16 h-3" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="w-4 h-4 rounded" />
            <SkeletonText className="w-20 h-3" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="w-4 h-4 rounded" />
            <SkeletonText className="w-24 h-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual post skeleton
 */
function PostSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Author Avatar */}
          <SkeletonAvatar size="md" />
          
          <div className="flex-1">
            {/* Post Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <SkeletonText className="w-24" />
                <SkeletonText className="w-20 h-3" />
              </div>
              <SkeletonText className="w-16 h-3" />
            </div>
            
            {/* Post Content */}
            <div className="space-y-2 mb-3">
              <SkeletonText className="w-full" />
              <SkeletonText className="w-4/5" />
              <SkeletonText className="w-3/5" />
            </div>
            
            {/* Post Actions */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Skeleton className="w-4 h-4 rounded" />
                <SkeletonText className="w-8 h-3" />
              </div>
              <div className="flex items-center space-x-1">
                <Skeleton className="w-4 h-4 rounded" />
                <SkeletonText className="w-12 h-3" />
              </div>
              <SkeletonText className="w-16 h-3" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * New post form skeleton
 */
function NewPostFormSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <SkeletonHeading level={3} className="w-40 mb-4" />
        
        {/* Textarea Skeleton */}
        <Skeleton className="w-full h-32 rounded-md mb-4" />
        
        {/* Form Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SkeletonButton variant="sm" className="w-20" />
            <SkeletonButton variant="sm" className="w-16" />
          </div>
          <SkeletonButton className="w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact post skeleton for replies
 */
function ReplyPostSkeleton() {
  return (
    <div className="ml-12 mt-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-start space-x-2">
        <SkeletonAvatar size="sm" />
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <SkeletonText className="w-20" />
            <SkeletonText className="w-16 h-3" />
          </div>
          <div className="space-y-1">
            <SkeletonText className="w-full" />
            <SkeletonText className="w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiscussionDetailSkeleton;
export { 
  DiscussionHeaderSkeleton, 
  PostSkeleton, 
  NewPostFormSkeleton,
  ReplyPostSkeleton 
};
