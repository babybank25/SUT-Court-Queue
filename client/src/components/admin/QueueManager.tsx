import React, { useEffect, useState, useRef } from 'react';
import { useAuthApi } from '../../hooks/useAuthApi';
import { useToast } from '../../contexts/ToastContext';
import { Team } from '../../types';

interface QueueResponse {
  queue: {
    teams: Team[];
    totalTeams: number;
    maxSize: number;
    availableSlots: number;
  };
}

interface StartMatchData {
  team1Id: string;
  team2Id: string;
  targetScore: number;
  matchType: 'regular' | 'champion-return';
}

interface CourtStatus {
  isOpen: boolean;
  mode: 'regular' | 'champion-return';
  cooldownEnd?: string;
  currentTime: string;
}

interface DragItem {
  id: string;
  index: number;
}

export const QueueManager: React.FC = () => {
  const [queueTeams, setQueueTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [maxSize, setMaxSize] = useState(10);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [showStartMatchModal, setShowStartMatchModal] = useState(false);
  const [courtStatus, setCourtStatus] = useState<CourtStatus | null>(null);
  
  const { get, put, del, post } = useAuthApi();
  const { showToast } = useToast();
  const dragCounter = useRef(0);

  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await get<any>('/api/admin/dashboard');
      
      if (response.success && response.data) {
        const sortedTeams = response.data.queue.teams
          .filter((team: Team) => team.status === 'waiting')
          .sort((a: Team, b: Team) => (a.position || 0) - (b.position || 0));
        setQueueTeams(sortedTeams);
        setMaxSize(response.data.queue.maxSize);
        setCourtStatus(response.data.courtStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromQueue = async (teamId: string) => {
    if (!confirm('Are you sure you want to remove this team from the queue?')) {
      return;
    }

    try {
      setActionLoading(teamId);
      const response = await del(`/api/admin/teams/${teamId}`);
      
      if (response.success) {
        setQueueTeams(queueTeams.filter(team => team.id !== teamId));
        showToast('success', 'Team Removed', 'Team has been removed from the queue');
      }
    } catch (err) {
      showToast('error', 'Remove Failed', err instanceof Error ? err.message : 'Failed to remove team');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReorderQueue = async (newOrder: Team[]) => {
    try {
      setActionLoading('reorder');
      const teamPositions = newOrder.map((team, index) => ({
        id: team.id,
        position: index + 1
      }));

      const response = await put('/api/admin/queue/reorder', { teamPositions });
      
      if (response.success) {
        setQueueTeams(newOrder);
        showToast('success', 'Queue Reordered', 'Queue positions have been updated');
      }
    } catch (err) {
      showToast('error', 'Reorder Failed', err instanceof Error ? err.message : 'Failed to reorder queue');
      // Revert to original order
      await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartMatch = async (matchData: StartMatchData) => {
    try {
      setActionLoading('start-match');
      const response = await post('/api/admin/match/start', matchData);
      
      if (response.success) {
        // Refresh queue to reflect teams moved to playing status
        await fetchQueue();
        setSelectedTeams(new Set());
        setShowStartMatchModal(false);
        showToast('success', 'Match Started', 'Match has been started successfully');
      }
    } catch (err) {
      showToast('error', 'Start Match Failed', err instanceof Error ? err.message : 'Failed to start match');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickStartMatch = () => {
    if (queueTeams.length < 2) {
      showToast('warning', 'Not Enough Teams', 'At least 2 teams are needed to start a match');
      return;
    }
    
    // Auto-select first two teams
    const firstTwo = queueTeams.slice(0, 2);
    setSelectedTeams(new Set(firstTwo.map(t => t.id)));
    setShowStartMatchModal(true);
  };

  const handleBulkRemove = async () => {
    if (selectedTeams.size === 0) return;
    
    if (!confirm(`Are you sure you want to remove ${selectedTeams.size} team(s) from the queue?`)) {
      return;
    }

    try {
      setActionLoading('bulk-remove');
      const deletePromises = Array.from(selectedTeams).map(teamId => 
        del(`/api/admin/teams/${teamId}`)
      );
      
      await Promise.all(deletePromises);
      
      setQueueTeams(queueTeams.filter(team => !selectedTeams.has(team.id)));
      setSelectedTeams(new Set());
      showToast('success', 'Teams Removed', `${selectedTeams.size} team(s) have been removed from the queue`);
    } catch (err) {
      showToast('error', 'Bulk Remove Failed', err instanceof Error ? err.message : 'Failed to remove teams');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCourtStatusChange = async (action: 'open' | 'close' | 'regular-mode' | 'champion-mode') => {
    try {
      setActionLoading(`court-${action}`);
      const response = await post(`/api/admin/court/${action}`, {});
      
      if (response.success) {
        await fetchQueue(); // Refresh to get updated court status
        showToast('success', 'Court Status Updated', `Court ${action.replace('-', ' ')} applied successfully`);
      }
    } catch (err) {
      showToast('error', 'Court Update Failed', err instanceof Error ? err.message : `Failed to ${action} court`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMoveToTop = async () => {
    if (selectedTeams.size === 0) return;
    
    try {
      setActionLoading('move-to-top');
      
      // Create new order with selected teams at the top
      const selectedTeamsList = queueTeams.filter(team => selectedTeams.has(team.id));
      const unselectedTeams = queueTeams.filter(team => !selectedTeams.has(team.id));
      const newOrder = [...selectedTeamsList, ...unselectedTeams];
      
      await handleReorderQueue(newOrder);
      setSelectedTeams(new Set());
      showToast('success', 'Teams Moved', `${selectedTeams.size} team(s) moved to top of queue`);
    } catch (err) {
      showToast('error', 'Move Failed', err instanceof Error ? err.message : 'Failed to move teams');
    } finally {
      setActionLoading(null);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, team: Team, index: number) => {
    setDraggedItem({ id: team.id, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
    
    // Add some visual feedback
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedItem(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIndex(null);

    if (!draggedItem || draggedItem.index === dropIndex) {
      return;
    }

    const newOrder = [...queueTeams];
    const draggedTeam = newOrder[draggedItem.index];
    
    // Remove the dragged item
    newOrder.splice(draggedItem.index, 1);
    
    // Insert at new position
    newOrder.splice(dropIndex, 0, draggedTeam);
    
    setQueueTeams(newOrder);
    handleReorderQueue(newOrder);
  };

  useEffect(() => {
    fetchQueue();
    
    // Refresh queue every 30 seconds
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const StartMatchModal: React.FC = () => {
    const [formData, setFormData] = useState({
      targetScore: 21,
      matchType: 'regular' as 'regular' | 'champion-return'
    });

    const selectedTeamsList = queueTeams.filter(team => selectedTeams.has(team.id));

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (selectedTeamsList.length !== 2) {
        showToast('warning', 'Invalid Selection', 'Please select exactly 2 teams to start a match');
        return;
      }

      handleStartMatch({
        team1Id: selectedTeamsList[0].id,
        team2Id: selectedTeamsList[1].id,
        targetScore: formData.targetScore,
        matchType: formData.matchType
      });
    };

    if (!showStartMatchModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800">Start New Match</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Teams
              </label>
              <div className="space-y-2">
                {selectedTeamsList.map((team, index) => (
                  <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-gray-600">{team.members} members, {team.wins} wins</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Team {index + 1}
                    </div>
                  </div>
                ))}
              </div>
              {selectedTeamsList.length !== 2 && (
                <p className="text-sm text-red-600 mt-1">
                  Please select exactly 2 teams from the queue
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Score
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.targetScore}
                onChange={(e) => setFormData({ ...formData, targetScore: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Type
              </label>
              <select
                value={formData.matchType}
                onChange={(e) => setFormData({ ...formData, matchType: e.target.value as 'regular' | 'champion-return' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="regular">Regular Match</option>
                <option value="champion-return">Champion Return</option>
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={actionLoading === 'start-match' || selectedTeamsList.length !== 2}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'start-match' ? 'Starting...' : 'Start Match'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStartMatchModal(false);
                  setSelectedTeams(new Set());
                }}
                disabled={actionLoading === 'start-match'}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (isLoading && queueTeams.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Queue Management</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-3 border rounded">
              <div className="w-6 h-6 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Queue Management</h3>
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">⚠️</div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchQueue}
            className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Queue Management</h3>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600">
              {queueTeams.length} / {maxSize} teams
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleQuickStartMatch}
                disabled={queueTeams.length < 2 || actionLoading !== null}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                title="Start match with first 2 teams"
              >
                Quick Start
              </button>
              
              {selectedTeams.size > 0 && (
                <>
                  <button
                    onClick={() => setShowStartMatchModal(true)}
                    disabled={selectedTeams.size !== 2 || actionLoading !== null}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    title="Start match with selected teams"
                  >
                    Start Match ({selectedTeams.size})
                  </button>
                  
                  <button
                    onClick={() => handleMoveToTop()}
                    disabled={selectedTeams.size === 0 || actionLoading !== null}
                    className="bg-orange-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    title="Move selected teams to top of queue"
                  >
                    Move to Top
                  </button>
                  
                  <button
                    onClick={handleBulkRemove}
                    disabled={actionLoading !== null}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    title="Remove selected teams"
                  >
                    Remove ({selectedTeams.size})
                  </button>
                </>
              )}
            </div>
            
            <button
              onClick={fetchQueue}
              disabled={isLoading}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh queue"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Court Status Section */}
        {courtStatus && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Court Status</h4>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${courtStatus.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">
                  {courtStatus.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-2">Court Controls</div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleCourtStatusChange(courtStatus.isOpen ? 'close' : 'open')}
                    disabled={actionLoading?.startsWith('court-')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      courtStatus.isOpen 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50`}
                  >
                    {actionLoading?.startsWith('court-') ? 'Updating...' : (courtStatus.isOpen ? 'Close Court' : 'Open Court')}
                  </button>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-2">
                  Mode: <span className="font-medium capitalize">{courtStatus.mode.replace('-', ' ')}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleCourtStatusChange('regular-mode')}
                    disabled={courtStatus.mode === 'regular' || actionLoading?.startsWith('court-')}
                    className="px-3 py-1 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Regular Mode
                  </button>
                  <button
                    onClick={() => handleCourtStatusChange('champion-mode')}
                    disabled={courtStatus.mode === 'champion-return' || actionLoading?.startsWith('court-')}
                    className="px-3 py-1 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    Champion Mode
                  </button>
                </div>
              </div>
            </div>
            
            {courtStatus.cooldownEnd && (
              <div className="mt-3 p-2 bg-orange-100 rounded text-sm text-orange-800">
                <span className="font-medium">Champion Cooldown:</span> Active until {new Date(courtStatus.cooldownEnd).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {queueTeams.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-gray-500">Queue is empty</p>
            <p className="text-sm text-gray-400 mt-1">Teams will appear here when they join the queue</p>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center text-blue-800">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">
                    Drag and drop teams to reorder the queue, or select teams to start matches
                  </span>
                </div>
              </div>
              
              {selectedTeams.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center text-green-800">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {selectedTeams.size} team(s) selected
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedTeams(new Set())}
                    className="text-sm text-green-700 hover:text-green-900 font-medium"
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {queueTeams.map((team, index) => (
                <div
                  key={team.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, team, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`
                    flex items-center space-x-4 p-4 border rounded-lg transition-all
                    ${dragOverIndex === index ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}
                    ${draggedItem?.id === team.id ? 'opacity-50' : ''}
                    ${selectedTeams.has(team.id) ? 'bg-blue-50 border-blue-300' : ''}
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedTeams.has(team.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedTeams);
                        if (e.target.checked) {
                          newSet.add(team.id);
                        } else {
                          newSet.delete(team.id);
                        }
                        setSelectedTeams(newSet);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                      {index + 1}
                    </div>
                    <div 
                      className="cursor-move"
                      title="Drag to reorder"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-gray-900">{team.name}</h4>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {team.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span>{team.members} members</span>
                      <span>{team.wins} wins</span>
                      <span>Last seen: {formatLastSeen(team.lastSeen)}</span>
                      {team.contactInfo && (
                        <span className="truncate max-w-32" title={team.contactInfo}>
                          Contact: {team.contactInfo}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleRemoveFromQueue(team.id)}
                      disabled={actionLoading === team.id || actionLoading === 'reorder'}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      title="Remove from queue"
                    >
                      {actionLoading === team.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {actionLoading === 'reorder' && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center text-yellow-800">
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">Updating queue positions...</span>
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <div>
                  <span className="font-medium">Queue Status:</span>
                  <span className="ml-2">
                    {queueTeams.length < maxSize ? 
                      `${maxSize - queueTeams.length} slots available` : 
                      'Queue is full'
                    }
                  </span>
                </div>
                <div>
                  <span className="font-medium">Next up:</span>
                  <span className="ml-2">
                    {queueTeams.length > 0 ? queueTeams[0].name : 'No teams waiting'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      <StartMatchModal />
    </div>
  );
};