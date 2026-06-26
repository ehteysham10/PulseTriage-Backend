import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import nodemailer from 'nodemailer';
import Ticket from '../models/Ticket.js';

const connectionUrl = process.env.REDIS_URL;
const connection = connectionUrl 
  ? new IORedis(connectionUrl, { maxRetriesPerRequest: null })
  : new IORedis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });

/**
 * Initializes the Nodemailer test transporter.
 * Ethereal Email is used for fake testing to generate verifiable URLs.
 */
async function createTestTransporter() {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });
}

/**
 * Starts the SLA Worker to monitor delayed jobs.
 */
export const startSlaWorker = () => {
  console.log('[SLA Worker] Initializing and connecting to Redis...');
  
  const worker = new Worker('SLA_Escalation', async (job) => {
    const { ticketId } = job.data;
    console.log(`[SLA Worker] Job triggered for ticket ${ticketId}. Checking status...`);

    try {
      const ticket = await Ticket.findById(ticketId);
      
      if (!ticket) {
        console.log(`[SLA Worker] Ticket ${ticketId} not found.`);
        return;
      }

      // If the ticket is still 'Open', it means no one has started working on it
      if (ticket.status === 'Open') {
        console.log(`[SLA Worker] URGENT: Ticket ${ticketId} is still 'Open' after SLA timeframe! Escalating...`);
        
        const transporter = await createTestTransporter();
        const info = await transporter.sendMail({
          from: '"PulseTriage SLA Monitor" <sla@pulsetriage.local>',
          to: 'admin@pulsetriage.local',
          subject: `SLA BREACH ALERT: High Priority Ticket - ${ticket.title}`,
          text: `Ticket ID: ${ticket._id}\nTitle: ${ticket.title}\nDescription: ${ticket.description}\n\nThis high-priority ticket has breached the SLA limit and is still in 'Open' status. Please assign immediately!`,
          html: `<p><b>Ticket ID:</b> ${ticket._id}</p><p><b>Title:</b> ${ticket.title}</p><p><b>Description:</b> ${ticket.description}</p><p style="color:red;">This high-priority ticket has breached the SLA limit and is still in 'Open' status. Please assign immediately!</p>`,
        });

        console.log('[SLA Worker] Escalation email sent successfully.');
        console.log(`[SLA Worker] Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      } else {
        console.log(`[SLA Worker] Ticket ${ticketId} is currently '${ticket.status}'. No escalation needed.`);
      }
    } catch (error) {
      console.error(`[SLA Worker] Error processing SLA job for ticket ${ticketId}:`, error);
    }
  }, { connection });

  worker.on('completed', job => {
    console.log(`[SLA Worker] Job with ID ${job.id} has been processed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[SLA Worker] Job with ID ${job.id} failed with error:`, err.message);
  });
};
