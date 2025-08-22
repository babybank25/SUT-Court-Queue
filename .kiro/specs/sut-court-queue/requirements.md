# Requirements Document

## Introduction

ระบบ SUT Court Queue เป็นแอปพลิเคชันสำหรับจัดการคิวการแข่งขันกีฬาบาสเกตบอลในมหาวิทยาลัย โดยมีฟีเจอร์หลักคือการจัดการคิวทีม การแสดงผลการแข่งขันแบบเรียลไทม์ และระบบแอดมินสำหรับจัดการการแข่งขัน

## Requirements

### Requirement 1

**User Story:** As a basketball team, I want to join the court queue, so that I can participate in matches when it's my turn

#### Acceptance Criteria

1. WHEN a team accesses the public queue page THEN the system SHALL display the current queue list with team names and positions
2. WHEN a team clicks "Join Queue" THEN the system SHALL display a form with team name, number of players, and contact info fields
3. WHEN a team submits valid queue information THEN the system SHALL add the team to the queue and display confirmation
4. WHEN a team enters invalid information THEN the system SHALL display appropriate error messages
5. IF the queue is full THEN the system SHALL prevent new teams from joining and display a message

### Requirement 2

**User Story:** As a spectator, I want to view live match scores, so that I can follow the current game progress

#### Acceptance Criteria

1. WHEN a match is active THEN the system SHALL display real-time scores for both teams
2. WHEN the match status changes THEN the system SHALL update the display within 5 seconds
3. WHEN a match ends THEN the system SHALL show the final score and winner
4. WHEN no match is active THEN the system SHALL display "No active match" message
5. WHEN viewing match details THEN the system SHALL show match type, target score, and duration

### Requirement 3

**User Story:** As a team captain, I want to confirm match results, so that the final score is officially recorded

#### Acceptance Criteria

1. WHEN a match ends THEN the system SHALL require confirmation from both teams
2. WHEN one team confirms the result THEN the system SHALL show "waiting for opponent confirmation"
3. WHEN both teams confirm THEN the system SHALL record the final result and update statistics
4. IF teams disagree on the result THEN the system SHALL provide a "Force Resolve" option for admins
5. WHEN the confirmation timeout expires THEN the system SHALL automatically resolve with current scores

### Requirement 4

**User Story:** As an admin, I want to manage teams and matches, so that I can oversee court operations efficiently

#### Acceptance Criteria

1. WHEN an admin accesses the dashboard THEN the system SHALL display active matches, queue status, and team management
2. WHEN an admin starts a match THEN the system SHALL move teams from queue to active match status
3. WHEN an admin manages teams THEN the system SHALL allow editing team details, wins, and status
4. WHEN an admin views statistics THEN the system SHALL display team performance and match history
5. WHEN an admin forces match resolution THEN the system SHALL override team confirmations and record results

### Requirement 5

**User Story:** As a user, I want to see court status information, so that I know when the court is available

#### Acceptance Criteria

1. WHEN accessing the system THEN the system SHALL display current court status (open/closed)
2. WHEN the court is in champion-return mode THEN the system SHALL show the countdown timer
3. WHEN displaying time information THEN the system SHALL show current time in Asia/Bangkok timezone
4. WHEN the court status changes THEN the system SHALL update all connected clients within 10 seconds
5. WHEN viewing queue information THEN the system SHALL show total number of teams waiting

### Requirement 6

**User Story:** As a system user, I want responsive navigation, so that I can easily switch between different views

#### Acceptance Criteria

1. WHEN using the navigation THEN the system SHALL provide tabs for Public Queue, Match View, and Admin
2. WHEN switching views THEN the system SHALL maintain user session and preferences
3. WHEN accessing admin features THEN the system SHALL require proper authentication
4. WHEN on mobile devices THEN the system SHALL display a responsive layout
5. WHEN navigation fails THEN the system SHALL show appropriate error messages and fallback options