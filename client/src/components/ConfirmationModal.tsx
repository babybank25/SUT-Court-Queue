import React, { useState, useEffect, useCallback } from 'react';
import { Match, Team } from '../types';
import { useSocketContext } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  currentTeam?: Team; // The team that is confirming
  onConfirmationSuccess?: (confirmed: boolean) => void;
}

interface ConfirmationState {
  isSubmitting: boolean;
  hasConfirmed: boolean;
  confirmationValue: boolean | null;
  error: string | null;
  timeoutCountdown: number;
}

const CONFIRMATION_TIMEOUT = 60; // 60 seconds timeout

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  match,
  currentTeam,
  onConfirmationSuccess
}) => {
  const { isConnected, confirmResult } = useSocketContext();
  const { addToast } = useToast();
  
  const [state, setState] = useState<ConfirmationState>({
    isSubmitting: false,
    hasConfirmed: false,
    confirmationValue: null,
    error: null,
    timeoutCountdown: CONFIRMATION_TIMEOUT
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setState({
        isSubmitting: false,
        hasConfirmed: false,
        confirmationValue: null,
        error: null,
        timeoutCountdown: CONFIRMATION_TIMEOUT
      });
    }
  }, [isOpen]);

  // Countdown timer for timeout
  useEffect(() => {
    if (!isOpen || state.hasConfirmed) return;

    const timer = setInterval(() => {
      setState(prev => {
        if (prev.timeoutCountdown <= 1) {
          // Auto-confirm with current score when timeout reaches 0
          handleAutoConfirm();
          return prev;
        }
        return { ...prev, timeoutCountdown: prev.timeoutCountdown - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, state.hasConfirmed]);

  // Auto-confirm when timeout is reached
  const handleAutoConfirm = useCallback(async () => {
    if (!currentTeam || state.hasConfirmed) return;

    try {
      setState(prev => ({ ...prev, isSubmitting: true, error: null }));
      
      // Auto-confirm with true (accept current score)
      const success = await handleConfirmation(true, true);
      
      if (success) {
        addToast({
          type: 'warning',
          title: 'Auto-Confirmed',
          message: 'Match result was automatically confirmed due to timeout',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Auto-confirmation failed:', error);
    }
  }, [currentTeam, state.hasConfirmed]);

  // Handle confirmation submission
  const handleConfirmation = async (confirmed: boolean, isAutoConfirm = false): Promise<boolean> => {
    if (!currentTeam) {
      setState(prev => ({ ...prev, error: 'No team selected for confirmation' }));
      return false;
    }

    if (!isConnected) {
      setState(prev => ({ ...prev, error: 'Not connected to server. Please check your connection.' }));
      return false;
    }

    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      // Try WebSocket first
      const socketSuccess = confirmResult(match.id, currentTeam.id, confirmed);
      
      if (socketSuccess) {
        setState(prev => ({ 
          ...prev, 
          hasConfirmed: true, 
          confirmationValue: confirmed,
          isSubmitting: false 
        }));

        if (!isAutoConfirm) {
          addToast({
            type: confirmed ? 'success' : 'info',
            title: confirmed ? 'Result Confirmed' : 'Result Disputed',
            message: confirmed 
              ? 'You have confirmed the match result' 
              : 'You have disputed the match result. Admin will resolve.',
            duration: 4000
          });
        }

        if (onConfirmationSuccess) {
          onConfirmationSuccess(confirmed);
        }

        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 2000);

        return true;
      } else {
        // Fallback to HTTP API
        const response = await fetch('/api/match/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            matchId: match.id,
            teamId: currentTeam.id,
            confirmed
          }),
        });

        const result = await response.json();

        if (result.success) {
          setState(prev => ({ 
            ...prev, 
            hasConfirmed: true, 
            confirmationValue: confirmed,
            isSubmitting: false 
          }));

          if (!isAutoConfirm) {
            addToast({
              type: confirmed ? 'success' : 'info',
              title: confirmed ? 'Result Confirmed' : 'Result Disputed',
              message: result.data.message || 'Confirmation submitted successfully',
              duration: 4000
            });
          }

          if (onConfirmationSuccess) {
            onConfirmationSuccess(confirmed);
          }

          // Close modal after a short delay
          setTimeout(() => {
            onClose();
          }, 2000);

          return true;
        } else {
          const errorMessage = result.error?.message || 'Failed to submit confirmation';
          setState(prev => ({ ...prev, error: errorMessage, isSubmitting: false }));
          
          addToast({
            type: 'error',
            title: 'Confirmation Failed',
            message: errorMessage,
            duration: 4000
          });

          return false;
        }
      }
    } catch (error) {
      console.error('Error confirming match result:', error);
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please try again.';
      setState(prev => ({ ...prev, error: errorMessage, isSubmitting: false }));
      
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: errorMessage,
        duration: 4000
      });

      return false;
    }
  };

  // Get current team's confirmation status
  const getCurrentTeamConfirmationStatus = () => {
    if (!currentTeam) return null;
    
    if (currentTeam.id === match.team1.id) {
      return match.confirmed.team1;
    } else if (currentTeam.id === match.team2.id) {
      return match.confirmed.team2;
    }
    return null;
  };

  // Get opponent team's confirmation status
  const getOpponentConfirmationStatus = () => {
    if (!currentTeam) return null;
    
    if (currentTeam.id === match.team1.id) {
      return { confirmed: match.confirmed.team2, team: match.team2 };
    } else if (currentTeam.id === match.team2.id) {
      return { confirmed: match.confirmed.team1, team: match.team1 };
    }
    return null;
  };

  // Format countdown time
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if not open or match is not in confirming state
  if (!isOpen || match.status !== 'confirming') return null;

  const currentTeamConfirmed = getCurrentTeamConfirmationStatus();
  const opponentStatus = getOpponentConfirmationStatus();
  const bothConfirmed = match.confirmed.team1 && match.confirmed.team2;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Confirm Match Result</h2>
            <p className="text-sm text-gray-500 mt-1">
              {bothConfirmed ? 'Both teams have confirmed' : 'Waiting for confirmation'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={state.isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {state.hasConfirmed ? (
            // Success state
            <div className="text-center py-8">
              <div className="text-4xl mb-4">
                {state.confirmationValue ? '✅' : '❌'}
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {state.confirmationValue ? 'Result Confirmed!' : 'Result Disputed'}
              </h3>
              <p className="text-gray-600">
                {state.confirmationValue 
                  ? 'You have confirmed the match result.'
                  : 'You have disputed the result. An admin will resolve this match.'
                }
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This window will close automatically...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Match Score Display */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Final Score</h3>
                <div className="grid grid-cols-3 items-center gap-4">
                  <div className="text-center">
                    <p className="font-semibold text-gray-800 truncate" title={match.team1.name}>
                      {match.team1.name}
                    </p>
                    <p className="text-3xl font-bold text-blue-600">{match.score1}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">VS</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-800 truncate" title={match.team2.name}>
                      {match.team2.name}
                    </p>
                    <p className="text-3xl font-bold text-red-600">{match.score2}</p>
                  </div>
                </div>
              </div>

              {/* Timeout Warning */}
              {!state.hasConfirmed && state.timeoutCountdown <= 30 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-yellow-800">
                    <span className="text-sm">⏰</span>
                    <span className="text-sm font-medium">
                      Auto-confirm in {formatCountdown(state.timeoutCountdown)}
                    </span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    The result will be automatically confirmed if no action is taken
                  </p>
                </div>
              )}

              {/* Connection Warning */}
              {!isConnected && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-red-800">
                    <span className="text-sm">🔌</span>
                    <span className="text-sm font-medium">Not connected to server</span>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {state.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{state.error}</p>
                </div>
              )}

              {/* Confirmation Status */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Confirmation Status</h4>
                
                {/* Current Team Status */}
                {currentTeam && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-blue-800">
                        {currentTeam.name} (You)
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${
                      currentTeamConfirmed ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {currentTeamConfirmed ? '✓ Confirmed' : 'Waiting...'}
                    </span>
                  </div>
                )}

                {/* Opponent Team Status */}
                {opponentStatus && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-800">
                        {opponentStatus.team.name}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${
                      opponentStatus.confirmed ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {opponentStatus.confirmed ? '✓ Confirmed' : 'Waiting...'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirmation Question */}
              {!currentTeamConfirmed && currentTeam && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-800 mb-2">
                      Do you confirm this result?
                    </p>
                    <p className="text-sm text-gray-600">
                      Please verify the final score is correct
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleConfirmation(false)}
                      disabled={state.isSubmitting || !isConnected}
                      className="flex-1 px-4 py-3 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {state.isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">❌</span>
                          Dispute Result
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleConfirmation(true)}
                      disabled={state.isSubmitting || !isConnected}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {state.isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">✅</span>
                          Confirm Result
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      Timeout: {formatCountdown(state.timeoutCountdown)} remaining
                    </p>
                  </div>
                </div>
              )}

              {/* Already Confirmed Message */}
              {currentTeamConfirmed && (
                <div className="text-center py-4">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-lg font-medium text-green-800">
                    You have already confirmed this result
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {opponentStatus?.confirmed 
                      ? 'Both teams have confirmed. Match will be completed shortly.'
                      : `Waiting for ${opponentStatus?.team.name} to confirm...`
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};