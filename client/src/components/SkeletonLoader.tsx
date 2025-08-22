import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width = 'w-full', 
  height = 'h-4' 
}) => {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded ${width} ${height} ${className}`}
    />
  );
};

export const QueueListSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton width="w-8" height="h-8" className="rounded-full" />
              <div className="space-y-2">
                <Skeleton width="w-24" height="h-4" />
                <Skeleton width="w-16" height="h-3" />
              </div>
            </div>
            <div className="text-right space-y-2">
              <Skeleton width="w-12" height="h-4" />
              <Skeleton width="w-20" height="h-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ScoreboardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <Skeleton width="w-32" height="h-6" className="mx-auto mb-2" />
        <Skeleton width="w-24" height="h-4" className="mx-auto" />
      </div>
      
      <div className="grid grid-cols-3 gap-4 items-center">
        {/* Team 1 */}
        <div className="text-center space-y-3">
          <Skeleton width="w-20" height="h-6" className="mx-auto" />
          <Skeleton width="w-16" height="h-12" className="mx-auto" />
          <Skeleton width="w-12" height="h-4" className="mx-auto" />
        </div>
        
        {/* VS */}
        <div className="text-center">
          <Skeleton width="w-8" height="h-6" className="mx-auto" />
        </div>
        
        {/* Team 2 */}
        <div className="text-center space-y-3">
          <Skeleton width="w-20" height="h-6" className="mx-auto" />
          <Skeleton width="w-16" height="h-12" className="mx-auto" />
          <Skeleton width="w-12" height="h-4" className="mx-auto" />
        </div>
      </div>
      
      <div className="mt-6 text-center space-y-2">
        <Skeleton width="w-28" height="h-4" className="mx-auto" />
        <Skeleton width="w-20" height="h-4" className="mx-auto" />
      </div>
    </div>
  );
};

export const CourtStatusSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width="w-24" height="h-5" />
        <Skeleton width="w-16" height="h-6" className="rounded-full" />
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton width="w-16" height="h-4" />
          <Skeleton width="w-20" height="h-4" />
        </div>
        <div className="flex justify-between">
          <Skeleton width="w-12" height="h-4" />
          <Skeleton width="w-24" height="h-4" />
        </div>
        <div className="flex justify-between">
          <Skeleton width="w-20" height="h-4" />
          <Skeleton width="w-16" height="h-4" />
        </div>
      </div>
    </div>
  );
};

export const AdminDashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton width="w-16" height="h-4" />
                <Skeleton width="w-8" height="h-8" />
              </div>
              <Skeleton width="w-12" height="h-12" className="rounded-full" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Active Matches */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <Skeleton width="w-32" height="h-6" />
        </div>
        <div className="p-4 space-y-4">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="flex items-center justify-between p-4 border rounded">
              <div className="space-y-2">
                <Skeleton width="w-40" height="h-5" />
                <Skeleton width="w-24" height="h-4" />
              </div>
              <div className="flex space-x-2">
                <Skeleton width="w-16" height="h-8" />
                <Skeleton width="w-16" height="h-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Teams Management */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <Skeleton width="w-28" height="h-6" />
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <Skeleton width="w-8" height="h-8" className="rounded-full" />
                  <div className="space-y-1">
                    <Skeleton width="w-24" height="h-4" />
                    <Skeleton width="w-16" height="h-3" />
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Skeleton width="w-12" height="h-6" />
                  <Skeleton width="w-12" height="h-6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SkeletonCardProps {
  lines?: number;
  showAvatar?: boolean;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  lines = 3, 
  showAvatar = false,
  className = '' 
}) => {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        {showAvatar && (
          <Skeleton width="w-10" height="h-10" className="rounded-full flex-shrink-0" />
        )}
        <div className="flex-1 space-y-2">
          {[...Array(lines)].map((_, index) => (
            <Skeleton 
              key={index}
              width={index === lines - 1 ? 'w-3/4' : 'w-full'} 
              height="h-4" 
            />
          ))}
        </div>
      </div>
    </div>
  );
};