import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000';

// Connect Agent A
const agentA = io(SERVER_URL);
const agentAId = '6523c1234567890123456789';

// Connect Agent B
const agentB = io(SERVER_URL);
const agentBId = '6523c9876543210987654321';

console.log('Connecting agents...');

agentA.on('connect', () => {
  console.log(`Agent A connected with socket ID: ${agentA.id}`);
});

agentB.on('connect', () => {
  console.log(`Agent B connected with socket ID: ${agentB.id}`);
});

// Listeners for Agent A
agentA.on('ticket:created', (ticket) => {
  console.log(`\n[Agent A] New Ticket Created: ${ticket.title} (ID: ${ticket._id})`);
  
  // Agent A locks the ticket immediately upon receiving it
  console.log(`[Agent A] Attempting to lock ticket ${ticket._id}...`);
  agentA.emit('ticket:lock', { ticketId: ticket._id, agentId: agentAId });
});

agentA.on('ticket:locked', (data) => {
  console.log(`[Agent A] Broadcast received: Ticket ${data.ticketId} locked by Agent ${data.agentId}`);
});

agentA.on('ticket:unlocked', (data) => {
  console.log(`[Agent A] Broadcast received: Ticket ${data.ticketId} unlocked`);
});

// Listeners for Agent B
agentB.on('ticket:created', (ticket) => {
  console.log(`[Agent B] New Ticket Created: ${ticket.title} (ID: ${ticket._id})`);
});

agentB.on('ticket:locked', (data) => {
  console.log(`[Agent B] Broadcast received: Ticket ${data.ticketId} locked by Agent ${data.agentId}`);
  if (data.agentId !== agentBId) {
    console.log(`[Agent B] UI UPDATE: Graying out ticket ${data.ticketId} (Locked by another agent)`);
  }
});

agentB.on('ticket:unlocked', (data) => {
  console.log(`[Agent B] Broadcast received: Ticket ${data.ticketId} unlocked`);
  console.log(`[Agent B] UI UPDATE: Ticket ${data.ticketId} is now available`);
});

// Create a new ticket via the API after a short delay
setTimeout(async () => {
  console.log('\n--- Creating a test ticket via HTTP API ---');
  try {
    const res = await fetch(`${SERVER_URL}/api/tickets/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Network Issue',
        description: 'The router is not responding and the internet is down.',
        customerId: 'customer-1'
      })
    });
    
    const data = await res.json();
    console.log(`HTTP Response: ${data.message}`);

    // Wait a bit, then simulate Agent A disconnecting (closing tab)
    setTimeout(() => {
      console.log('\n--- Simulating Agent A closing the tab (disconnecting) ---');
      agentA.disconnect();
      
      // Wait a bit to see the unlock event on Agent B, then exit
      setTimeout(() => {
        console.log('\n--- Test Complete. Exiting ---');
        agentB.disconnect();
        process.exit(0);
      }, 1000);
    }, 2000);

  } catch (err) {
    console.error('Error creating ticket:', err);
  }
}, 1000);
