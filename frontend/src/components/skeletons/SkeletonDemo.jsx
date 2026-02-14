import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';

// Import skeleton components
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonHeading, 
  SkeletonAvatar, 
  SkeletonButton, 
  SkeletonCard 
} from './skeletons/Skeleton';
import ApothecaryPageSkeleton from './skeletons/ApothecaryPageSkeleton';
import ForumPageSkeleton from './skeletons/ForumPageSkeleton';
import DiscussionDetailSkeleton from './skeletons/DiscussionDetailSkeleton';

/**
 * Demo component to showcase all skeleton loading states
 * Useful for testing and development
 */
function SkeletonDemo() {
  const [activeDemo, setActiveDemo] = useState('basic');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🦴 Skeleton Loading Demo
        </h1>
        <p className="text-gray-600">
          Showcase of all skeleton loading components in the ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ
        </p>
      </div>

      <Tabs value={activeDemo} onValueChange={setActiveDemo} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Elements</TabsTrigger>
          <TabsTrigger value="apothecary">Apothecary</TabsTrigger>
          <TabsTrigger value="forum">Forum</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>

        {/* Basic Skeleton Elements */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Skeleton Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Text Skeletons */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Text Elements</h3>
                <div className="space-y-2">
                  <SkeletonHeading level={1} className="w-64" />
                  <SkeletonHeading level={2} className="w-48" />
                  <SkeletonHeading level={3} className="w-32" />
                  <SkeletonText className="w-full" />
                  <SkeletonText className="w-3/4" />
                  <SkeletonText className="w-1/2" />
                </div>
              </div>

              {/* Avatar Skeletons */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Avatars</h3>
                <div className="flex items-center space-x-4">
                  <SkeletonAvatar size="sm" />
                  <SkeletonAvatar size="md" />
                  <SkeletonAvatar size="lg" />
                  <SkeletonAvatar size="xl" />
                </div>
              </div>

              {/* Button Skeletons */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Buttons</h3>
                <div className="flex items-center space-x-4">
                  <SkeletonButton variant="sm" className="w-16" />
                  <SkeletonButton variant="default" className="w-24" />
                  <SkeletonButton variant="lg" className="w-32" />
                </div>
              </div>

              {/* Card Skeleton */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Card Layout</h3>
                <SkeletonCard className="max-w-md">
                  <div className="flex items-center space-x-3 mb-3">
                    <SkeletonAvatar size="md" />
                    <div className="flex-1">
                      <SkeletonText className="w-32 mb-1" />
                      <SkeletonText className="w-24 h-3" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <SkeletonText className="w-full" />
                    <SkeletonText className="w-4/5" />
                    <SkeletonText className="w-3/5" />
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <SkeletonButton variant="sm" className="w-16" />
                    <SkeletonButton variant="sm" className="w-20" />
                  </div>
                </SkeletonCard>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Apothecary Page Skeleton */}
        <TabsContent value="apothecary">
          <Card>
            <CardHeader>
              <CardTitle>Apothecary Page Loading State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50">
                <ApothecaryPageSkeleton />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forum Page Skeleton */}
        <TabsContent value="forum">
          <Card>
            <CardHeader>
              <CardTitle>Forum Page Loading State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50">
                <ForumPageSkeleton />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discussion Detail Skeleton */}
        <TabsContent value="discussion">
          <Card>
            <CardHeader>
              <CardTitle>Discussion Detail Loading State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-gray-50">
                <DiscussionDetailSkeleton />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage Examples */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Basic Usage:</h4>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`import { SkeletonText, SkeletonHeading } from '@/components/skeletons/Skeleton';

function MyComponent({ isLoading, data }) {
  if (isLoading) {
    return (
      <div>
        <SkeletonHeading level={1} className="w-64 mb-4" />
        <SkeletonText className="w-full mb-2" />
        <SkeletonText className="w-3/4" />
      </div>
    );
  }
  
  return <div>{/* Actual content */}</div>;
}`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Page-Level Usage:</h4>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`import ApothecaryPageSkeleton from '@/components/skeletons/ApothecaryPageSkeleton';

function ApothecaryPage() {
  const [isLoading, setIsLoading] = useState(true);
  
  if (isLoading) {
    return <ApothecaryPageSkeleton />;
  }
  
  return <div>{/* Page content */}</div>;
}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SkeletonDemo;
