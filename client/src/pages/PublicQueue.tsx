import React, { useState } from "react";
import { QueueList, CourtStatus, JoinQueueModal } from "../components";
import { useRealtimeQueue } from "../hooks/useRealtimeQueue";

export const PublicQueue: React.FC = () => {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { isQueueFull, isConnected } = useRealtimeQueue();

  const handleJoinSuccess = (teamData: {
    name: string;
    members: number;
    position: number;
  }) => {
    setSuccessMessage(
      `Team "${teamData.name}" successfully joined the queue at position ${teamData.position}!`
    );

    // Clear success message after 5 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">
          Public Queue
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          View current queue and join the line
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-start space-x-2 text-green-800">
            <span className="text-lg flex-shrink-0">🎉</span>
            <span className="font-medium text-sm sm:text-base">
              {successMessage}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Real-time Queue List */}
        <QueueList />

        {/* Real-time Court Status */}
        <CourtStatus />
      </div>

      {/* Join Queue Button */}
      <div className="text-center">
        <button
          onClick={() => setIsJoinModalOpen(true)}
          disabled={isQueueFull || !isConnected}
          className="bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto text-sm sm:text-base min-h-[44px] touch-manipulation"
        >
          {isQueueFull ? (
            <>
              <span className="mr-2">⚠️</span>
              <span className="hidden sm:inline">Queue Full</span>
              <span className="sm:hidden">Full</span>
            </>
          ) : !isConnected ? (
            <>
              <span className="mr-2">🔌</span>
              <span className="hidden sm:inline">Disconnected</span>
              <span className="sm:hidden">Offline</span>
            </>
          ) : (
            <>
              <span className="mr-2">🏀</span>
              <span className="hidden sm:inline">Join Queue</span>
              <span className="sm:hidden">Join</span>
            </>
          )}
        </button>

        {/* Helper text */}
        <p className="text-xs sm:text-sm text-gray-500 mt-2 px-2">
          {isQueueFull
            ? "Queue is currently full. Please wait for a spot to open up."
            : !isConnected
            ? "Please check your connection and try again."
            : "Click to add your team to the basketball queue"}
        </p>
      </div>

      {/* Join Queue Modal */}
      <JoinQueueModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={handleJoinSuccess}
      />
    </div>
  );
};
