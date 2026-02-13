import { Card, CardContent } from '@/components/ui/card.jsx';
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonHeading, 
  SkeletonButton, 
  SkeletonCard 
} from '@/components/ui/skeleton';

/**
 * Skeleton component for ApothecaryPage loading state
 * Matches the structure of the file management interface
 */
function ApothecaryPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Skeleton */}
      <div className="mb-8">
        <SkeletonHeading level={1} className="w-80 mb-2" />
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
            
            {/* Action Buttons Skeleton */}
            <div className="flex gap-2">
              <SkeletonButton className="w-32" />
              <SkeletonButton className="w-28" />
              <SkeletonButton className="w-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Area Skeleton */}
      <div className="space-y-6">
        {/* File Grid Skeleton */}
        <FileGridSkeleton />
        
        {/* Folder Tree Skeleton */}
        <FolderTreeSkeleton />
      </div>
    </div>
  );
}

/**
 * File grid skeleton showing file/folder cards
 */
function FileGridSkeleton() {
  return (
    <div>
      <SkeletonHeading level={3} className="w-48 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <FileCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual file card skeleton
 */
function FileCardSkeleton() {
  return (
    <SkeletonCard className="hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-3">
        {/* File Icon Skeleton */}
        <Skeleton className="w-8 h-8 rounded" />
        
        <div className="flex-1 min-w-0">
          {/* File Name */}
          <SkeletonText className="w-full mb-1" />
          {/* File Info */}
          <SkeletonText className="w-20 h-3" />
        </div>
      </div>
      
      {/* File Actions */}
      <div className="flex justify-end space-x-2 mt-3">
        <Skeleton className="w-6 h-6 rounded" />
        <Skeleton className="w-6 h-6 rounded" />
      </div>
    </SkeletonCard>
  );
}

/**
 * Folder tree skeleton for navigation
 */
function FolderTreeSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <SkeletonHeading level={4} className="w-32 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <FolderItemSkeleton key={index} depth={index % 3} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual folder item skeleton with indentation
 */
function FolderItemSkeleton({ depth = 0 }) {
  const indentClass = depth > 0 ? `ml-${depth * 4}` : '';
  
  return (
    <div className={`flex items-center space-x-2 py-1 ${indentClass}`}>
      <Skeleton className="w-4 h-4 rounded" />
      <SkeletonText className="w-24" />
      <SkeletonText className="w-8 h-3" />
    </div>
  );
}

/**
 * File list skeleton (alternative to grid view)
 */
function FileListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton className="w-6 h-6 rounded" />
              <div>
                <SkeletonText className="w-48 mb-1" />
                <SkeletonText className="w-24 h-3" />
              </div>
            </div>
            <div className="flex space-x-2">
              <Skeleton className="w-6 h-6 rounded" />
              <Skeleton className="w-6 h-6 rounded" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default ApothecaryPageSkeleton;
export { FileGridSkeleton, FileListSkeleton, FolderTreeSkeleton };
