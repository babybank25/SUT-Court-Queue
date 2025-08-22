#!/usr/bin/env ts-node

/**
 * Match Events Demo Script
 * Demonstrates the match events functionality
 */

import { matchEventsRepository } from '../database/matchEventsRepository';
import { initializeDatabase, closeDatabase } from '../database';

async function demonstrateMatchEvents() {
  console.log('🏀 Match Events Demo Starting...\n');

  try {
    // Initialize database
    await initializeDatabase();

    // Create sample match events
    console.log('📝 Creating sample match events...');

    // Score update event
    const scoreEvent = await matchEventsRepository.create({
      matchId: 'demo-match-1',
      eventType: 'score_update',
      eventData: {
        score1: 5,
        score2: 3,
        previousScore1: 4,
        previousScore2: 3,
        team1Name: 'Team Thunder',
        team2Name: 'Team Lightning'
      }
    });
    console.log('✅ Score update event created:', {
      id: scoreEvent.id,
      type: scoreEvent.eventType,
      score: `${scoreEvent.eventData.score1}-${scoreEvent.eventData.score2}`
    });

    // Status change event
    const statusEvent = await matchEventsRepository.create({
      matchId: 'demo-match-1',
      eventType: 'status_change',
      eventData: {
        status: 'confirming',
        previousStatus: 'active',
        reason: 'target_score_reached',
        targetScore: 21
      }
    });
    console.log('✅ Status change event created:', {
      id: statusEvent.id,
      type: statusEvent.eventType,
      status: statusEvent.eventData.status
    });

    // Confirmation event
    const confirmEvent = await matchEventsRepository.create({
      matchId: 'demo-match-1',
      eventType: 'confirmation',
      eventData: {
        teamName: 'Team Thunder',
        confirmed: true,
        bothConfirmed: false
      }
    });
    console.log('✅ Confirmation event created:', {
      id: confirmEvent.id,
      type: confirmEvent.eventType,
      team: confirmEvent.eventData.teamName,
      confirmed: confirmEvent.eventData.confirmed
    });

    // Timeout event
    const timeoutEvent = await matchEventsRepository.create({
      matchId: 'demo-match-1',
      eventType: 'timeout',
      eventData: {
        reason: 'confirmation_timeout',
        winner: 'Team Thunder',
        finalScore: '21-15',
        duration: 25,
        resolvedBy: 'system'
      }
    });
    console.log('✅ Timeout event created:', {
      id: timeoutEvent.id,
      type: timeoutEvent.eventType,
      winner: timeoutEvent.eventData.winner,
      finalScore: timeoutEvent.eventData.finalScore
    });

    // Retrieve events for the match
    console.log('\n📋 Retrieving match events...');
    const matchEvents = await matchEventsRepository.findByMatchId('demo-match-1');
    
    console.log(`Found ${matchEvents.length} events for match demo-match-1:`);
    matchEvents.forEach((event, index) => {
      console.log(`${index + 1}. [${event.eventType}] at ${event.createdAt.toISOString()}`);
      console.log(`   Data:`, JSON.stringify(event.eventData, null, 2));
    });

    // Retrieve recent events across all matches
    console.log('\n🕒 Retrieving recent events across all matches...');
    const recentEvents = await matchEventsRepository.findRecent(5);
    
    console.log(`Found ${recentEvents.length} recent events:`);
    recentEvents.forEach((event, index) => {
      console.log(`${index + 1}. Match ${event.matchId}: [${event.eventType}] at ${event.createdAt.toISOString()}`);
    });

    console.log('\n🎉 Match Events Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Run the demo if called directly
if (require.main === module) {
  demonstrateMatchEvents().catch(console.error);
}

export { demonstrateMatchEvents };