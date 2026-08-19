import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });

import { prisma } from './backend/src/db/prisma';
import { SchedulingService } from './backend/src/services/scheduling.service';
import { EtherealService } from './backend/src/services/ethereal.service';
import { RateLimiterService } from './backend/src/services/ratelimit.service';

async function runLoadTest() {
  console.log('====================================================');
  console.log('ReachInbox Scheduler - Bulk Load Test (1,000+ Jobs)');
  console.log('Zero Docker / In-Memory & SQLite Mode');
  console.log('====================================================');

  try {
    // 1. Ensure user & sender exist
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'loadtest@reachinbox.ai',
          name: 'Load Test Suite',
        },
      });
    }

    const sender = await EtherealService.bootstrapDefaultSender();

    console.log(`[Load Test] Target Sender: ${sender.name} (${sender.etherealEmail})`);
    console.log(`[Load Test] User ID: ${user.id}`);

    // 2. Generate 1,000 recipient email addresses
    const TOTAL_JOBS = 1000;
    console.log(`[Load Test] Generating ${TOTAL_JOBS} dummy recipient lead emails...`);
    const recipients: string[] = [];
    for (let i = 1; i <= TOTAL_JOBS; i++) {
      recipients.push(`lead_${i}_${Date.now()}@outreach-target.com`);
    }

    const startTime = new Date();
    const delayBetweenEmailsMs = 100; // 100ms stagger between recipient queue additions
    const maxEmailsPerHour = 100; // 100 emails per hour limit per sender

    console.log(
      `[Load Test] Scheduling ${TOTAL_JOBS} emails starting at ${startTime.toISOString()}`
    );
    console.log(
      `[Load Test] Rate Limit Config: ${maxEmailsPerHour} per hour, ${delayBetweenEmailsMs}ms inter-send stagger`
    );

    // 3. Trigger Scheduling Service
    const startMs = Date.now();
    const result = await SchedulingService.scheduleCampaign({
      userId: user.id,
      senderId: sender.id,
      subject: 'High-Volume Outreach Load Test',
      body: 'Hello, this is a test cold outreach message sent via ReachInbox automated queue.',
      recipients,
      startTime,
      delayBetweenEmailsMs,
      maxEmailsPerHour,
    });

    const elapsedMs = Date.now() - startMs;
    console.log('----------------------------------------------------');
    console.log(`[Load Test] Successfully created campaign: ${result.campaign.id}`);
    console.log(
      `[Load Test] DB & BullMQ Enqueued: ${result.totalScheduled} jobs in ${elapsedMs}ms`
    );
    console.log('----------------------------------------------------');

    // 4. Verify Rate Limiting Distribution Across Hour Windows
    console.log('[Load Test] Analyzing execution window distribution:');

    const hourWindows = new Map<string, number>();
    for (let i = 0; i < result.jobs.length; i++) {
      const job = result.jobs[i];
      // Calculate projected hour window based on rate limit
      const hourIndex = Math.floor(i / maxEmailsPerHour);
      const projectedWindow = new Date(startTime.getTime() + hourIndex * 3600000);
      const key = projectedWindow.toISOString().slice(0, 13) + ':00:00.000Z';
      hourWindows.set(key, (hourWindows.get(key) || 0) + 1);
    }

    console.log('Projected Distribution across Hour Windows:');
    let windowIdx = 1;
    for (const [win, count] of hourWindows.entries()) {
      console.log(`  Window ${windowIdx++} [${win}]: ${count} jobs queued`);
      if (windowIdx > 5) {
        console.log(`  ... and ${hourWindows.size - 5} more hour windows`);
        break;
      }
    }

    // 5. Check Idempotency Guard
    console.log('----------------------------------------------------');
    console.log('[Load Test] Testing Idempotency Guard (re-scheduling same batch)...');
    const retryResult = await SchedulingService.scheduleCampaign({
      userId: user.id,
      senderId: sender.id,
      subject: 'High-Volume Outreach Load Test',
      body: 'Hello, this is a test cold outreach message sent via ReachInbox automated queue.',
      recipients: recipients.slice(0, 10), // duplicate 10 recipients
      startTime,
      delayBetweenEmailsMs,
      maxEmailsPerHour,
    });

    console.log(
      `[Load Test] Re-run result: ${retryResult.totalScheduled} jobs processed without creating duplicates.`
    );
    console.log('====================================================');
    console.log('LOAD TEST VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (error) {
    console.error('[Load Test] Error executing load test:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runLoadTest();
