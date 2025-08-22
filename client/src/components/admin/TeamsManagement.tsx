import React, { useEffect, useState } from 'react';
import { useAuthApi } from '../../hooks/useAuthApi';
import { useToast } from '../../contexts/ToastContext';
import { Team } from '../../types';

interface TeamsResponse {
  teams: Team[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TeamStatistics {
  totalTeams: number;
  waitingTeams: number;
  playingTeams: number;
  cooldownTeams: number;
  totalWins: number;
  averageWins: number;
  topPerformers: Team[];
  recentlyActive: Team[];
}

interface TeamEditModalProps {
  team: Team | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (team: Team) => void;
}

const TeamEditModal: React.FC<TeamEditModalProps> = ({ team, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    members: 2,
    contactInfo: '',
    status: 'waiting' as Team['status'],
    wins: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { put } = useAuthApi();
  const { showToast } = useToast();

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name,
        members: team.members,
        contactInfo: team.contactInfo || '',
        status: team.status,
        wins: team.wins,
      });
    }
  }, [team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;

    try {
      setIsLoading(true);
      const response = await put(`/api/admin/teams/${team.id}`, formData);
      
      if (response.success && response.data) {
        onSave(response.data.team);
        showToast('success', 'Team Updated', 'Team information has been updated successfully');
        onClose();
      }
    } catch (err) {
      showToast('error', 'Update Failed', err instanceof Error ? err.message : 'Failed to update team');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-800">Edit Team</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Members
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.members}
              onChange={(e) => setFormData({ ...formData, members: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Info
            </label>
            <input
              type="text"
              value={formData.contactInfo}
              onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Team['status'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="waiting">Waiting</option>
              <option value="playing">Playing</option>
              <option value="cooldown">Cooldown</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wins
            </label>
            <input
              type="number"
              min="0"
              value={formData.wins}
              onChange={(e) => setFormData({ ...formData, wins: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
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

export const TeamsManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<TeamStatistics | null>(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>('');
  
  const { get, del, put } = useAuthApi();
  const { showToast } = useToast();

  const fetchTeams = async (page = 1, status = '') => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (status) {
        params.append('status', status);
      }
      
      const response = await get<TeamsResponse>(`/api/admin/teams?${params}`);
      
      if (response.success && response.data) {
        setTeams(response.data.teams);
        setPagination(response.data.pagination);
        calculateStatistics(response.data.teams);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teams');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStatistics = (teamList: Team[]) => {
    const totalTeams = teamList.length;
    const waitingTeams = teamList.filter(t => t.status === 'waiting').length;
    const playingTeams = teamList.filter(t => t.status === 'playing').length;
    const cooldownTeams = teamList.filter(t => t.status === 'cooldown').length;
    const totalWins = teamList.reduce((sum, team) => sum + team.wins, 0);
    const averageWins = totalTeams > 0 ? totalWins / totalTeams : 0;
    
    // Top 5 performers by wins
    const topPerformers = [...teamList]
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);
    
    // Recently active teams (last seen within 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentlyActive = teamList.filter(team => 
      new Date(team.lastSeen) > oneHourAgo
    ).slice(0, 5);
    
    setStatistics({
      totalTeams,
      waitingTeams,
      playingTeams,
      cooldownTeams,
      totalWins,
      averageWins,
      topPerformers,
      recentlyActive
    });
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(teamId);
      const response = await del(`/api/admin/teams/${teamId}`);
      
      if (response.success) {
        setTeams(teams.filter(team => team.id !== teamId));
        setSelectedTeams(prev => {
          const newSet = new Set(prev);
          newSet.delete(teamId);
          return newSet;
        });
        showToast('success', 'Team Deleted', 'Team has been deleted successfully');
      }
    } catch (err) {
      showToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed to delete team');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTeams.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedTeams.size} team(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading('bulk-delete');
      const deletePromises = Array.from(selectedTeams).map(teamId => 
        del(`/api/admin/teams/${teamId}`)
      );
      
      await Promise.all(deletePromises);
      
      setTeams(teams.filter(team => !selectedTeams.has(team.id)));
      setSelectedTeams(new Set());
      showToast('success', 'Teams Deleted', `${selectedTeams.size} team(s) have been deleted successfully`);
    } catch (err) {
      showToast('error', 'Bulk Delete Failed', err instanceof Error ? err.message : 'Failed to delete teams');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: Team['status']) => {
    if (selectedTeams.size === 0) return;
    
    if (!confirm(`Are you sure you want to update ${selectedTeams.size} team(s) to ${newStatus} status?`)) {
      return;
    }

    try {
      setActionLoading('bulk-status');
      const updatePromises = Array.from(selectedTeams).map(teamId => 
        put(`/api/admin/teams/${teamId}`, { status: newStatus })
      );
      
      await Promise.all(updatePromises);
      
      // Update local state
      setTeams(teams.map(team => 
        selectedTeams.has(team.id) ? { ...team, status: newStatus } : team
      ));
      setSelectedTeams(new Set());
      showToast('success', 'Status Updated', `${selectedTeams.size} team(s) status updated to ${newStatus}`);
    } catch (err) {
      showToast('error', 'Bulk Update Failed', err instanceof Error ? err.message : 'Failed to update team status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkWinsReset = async () => {
    if (selectedTeams.size === 0) return;
    
    if (!confirm(`Are you sure you want to reset wins for ${selectedTeams.size} team(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading('bulk-wins-reset');
      const updatePromises = Array.from(selectedTeams).map(teamId => 
        put(`/api/admin/teams/${teamId}`, { wins: 0 })
      );
      
      await Promise.all(updatePromises);
      
      // Update local state
      setTeams(teams.map(team => 
        selectedTeams.has(team.id) ? { ...team, wins: 0 } : team
      ));
      setSelectedTeams(new Set());
      showToast('success', 'Wins Reset', `Wins reset for ${selectedTeams.size} team(s)`);
    } catch (err) {
      showToast('error', 'Bulk Reset Failed', err instanceof Error ? err.message : 'Failed to reset wins');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedTeams.size === 0) return;

    switch (bulkAction) {
      case 'delete':
        await handleBulkDelete();
        break;
      case 'status-waiting':
        await handleBulkStatusUpdate('waiting');
        break;
      case 'status-cooldown':
        await handleBulkStatusUpdate('cooldown');
        break;
      case 'reset-wins':
        await handleBulkWinsReset();
        break;
      default:
        break;
    }
    setBulkAction('');
  };

  const handleSelectAll = () => {
    if (selectedTeams.size === teams.length) {
      setSelectedTeams(new Set());
    } else {
      setSelectedTeams(new Set(teams.map(team => team.id)));
    }
  };

  const handleTeamUpdate = (updatedTeam: Team) => {
    setTeams(teams.map(team => team.id === updatedTeam.id ? updatedTeam : team));
  };

  useEffect(() => {
    fetchTeams(pagination.page, statusFilter);
  }, [pagination.page, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-blue-100 text-blue-800';
      case 'playing':
        return 'bg-green-100 text-green-800';
      case 'cooldown':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (isLoading && teams.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Teams Management</h3>
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/6"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
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
        <h3 className="text-lg font-semibold mb-4">Teams Management</h3>
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">⚠️</div>
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={() => fetchTeams()}
            className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Panel */}
      {statistics && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Team Statistics</h3>
              <button
                onClick={() => setShowStatistics(!showStatistics)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showStatistics ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{statistics.totalTeams}</div>
                <div className="text-sm text-blue-800">Total Teams</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{statistics.waitingTeams}</div>
                <div className="text-sm text-green-800">Waiting</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{statistics.playingTeams}</div>
                <div className="text-sm text-orange-800">Playing</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{statistics.cooldownTeams}</div>
                <div className="text-sm text-purple-800">Cooldown</div>
              </div>
            </div>

            {showStatistics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Performance Stats */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Performance Overview</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Wins:</span>
                      <span className="font-medium">{statistics.totalWins}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Wins per Team:</span>
                      <span className="font-medium">{statistics.averageWins.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Teams with Wins:</span>
                      <span className="font-medium">
                        {statistics.topPerformers.filter(t => t.wins > 0).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Most Wins:</span>
                      <span className="font-medium">
                        {statistics.topPerformers.length > 0 ? statistics.topPerformers[0].wins : 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Performers */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Top Performers</h4>
                  <div className="space-y-2">
                    {statistics.topPerformers.slice(0, 3).map((team, index) => (
                      <div key={team.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="font-medium truncate">{team.name}</span>
                        </div>
                        <span className="text-gray-600">{team.wins} wins</span>
                      </div>
                    ))}
                    {statistics.topPerformers.length === 0 && (
                      <p className="text-sm text-gray-500 italic">No teams with wins yet</p>
                    )}
                  </div>
                </div>

                {/* Recently Active */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recently Active</h4>
                  <div className="space-y-2">
                    {statistics.recentlyActive.slice(0, 3).map((team) => (
                      <div key={team.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-medium truncate">{team.name}</span>
                        </div>
                        <span className="text-gray-600 text-xs">
                          {formatLastSeen(team.lastSeen)}
                        </span>
                      </div>
                    ))}
                    {statistics.recentlyActive.length === 0 && (
                      <p className="text-sm text-gray-500 italic">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Teams Management */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Teams Management</h3>
            <div className="flex items-center space-x-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="waiting">Waiting</option>
                <option value="playing">Playing</option>
                <option value="cooldown">Cooldown</option>
              </select>
              
              {selectedTeams.size > 0 && (
                <>
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Bulk Actions</option>
                    <option value="delete">Delete Selected</option>
                    <option value="status-waiting">Set to Waiting</option>
                    <option value="status-cooldown">Set to Cooldown</option>
                    <option value="reset-wins">Reset Wins</option>
                  </select>
                  
                  {bulkAction && (
                    <button
                      onClick={handleBulkAction}
                      disabled={actionLoading !== null}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading ? 'Processing...' : `Apply to ${selectedTeams.size}`}
                    </button>
                  )}
                </>
              )}
              
              <button
                onClick={() => fetchTeams(pagination.page, statusFilter)}
                disabled={isLoading}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Refresh teams"
              >
                <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      <div className="p-6">
        {teams.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-gray-500">No teams found</p>
            <p className="text-sm text-gray-400 mt-1">Teams will appear here when they join the queue</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedTeams.size === teams.length && teams.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  {selectedTeams.size > 0 ? `${selectedTeams.size} selected` : 'Select all'}
                </span>
              </div>
              
              <div className="text-sm text-gray-600">
                Showing {teams.length} of {pagination.total} teams
              </div>
            </div>

            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center space-x-4 p-4 border rounded hover:bg-gray-50 transition-colors">
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
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-gray-900">{team.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(team.status)}`}>
                        {team.status}
                      </span>
                      {team.position && (
                        <span className="text-xs text-gray-500">
                          Position: {team.position}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>{team.members} members</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{team.wins} wins</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Last seen: {formatLastSeen(team.lastSeen)}</span>
                      </span>
                      {team.contactInfo && (
                        <span className="flex items-center space-x-1 truncate max-w-32" title={team.contactInfo}>
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="truncate">{team.contactInfo}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingTeam(team)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      disabled={actionLoading === team.id}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === team.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchTeams(pagination.page - 1, statusFilter)}
                    disabled={pagination.page <= 1 || isLoading}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchTeams(pagination.page + 1, statusFilter)}
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

        <TeamEditModal
          team={editingTeam}
          isOpen={!!editingTeam}
          onClose={() => setEditingTeam(null)}
          onSave={handleTeamUpdate}
        />
      </div>
    </div>
  );
};