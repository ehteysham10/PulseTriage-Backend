import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connectionUrl = process.env.REDIS_URL;
const connection = connectionUrl 
  ? new IORedis(connectionUrl, { maxRetriesPerRequest: null })
  : new IORedis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });

// Create the SLA Escalation queue
export const slaQueue = new Queue('SLA_Escalation', { connection });

/**
 * Adds a delayed job to the SLA queue.
 * @param {string} ticketId - The ID of the ticket to monitor.
 * @param {number} delayMs - The delay in milliseconds before the job runs.
 */
export const addSlaJob = async (ticketId, delayMs) => {
  try {
    await slaQueue.add('check-sla', { ticketId }, { delay: delayMs });
    console.log(`[SLA Worker] Monitoring job for ticket ${ticketId}. Countdown: ${delayMs / 1000} seconds...`);
  } catch (error) {
    console.error(`[SLA Queue] Error adding job for ticket ${ticketId}:`, error);
  }
};
