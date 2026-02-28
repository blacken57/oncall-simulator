<script lang="ts">
  import { engine } from '$lib/game/engine.svelte';
  import type { Ticket } from '$lib/game/schema';

  let tickets = $derived(engine.tickets);
  let openTickets = $derived(tickets.filter((t) => t.status === 'open'));
  let inProgressTickets = $derived(tickets.filter((t) => t.status === 'investigating'));
  let resolvedTickets = $derived(tickets.filter((t) => t.status === 'resolved'));

  function updateStatus(ticket: Ticket, newStatus: Ticket['status']) {
    const t = engine.tickets.find((x) => x.id === ticket.id);
    if (t) {
      t.status = newStatus;
      if (newStatus === 'resolved') {
        t.resolvedAt = engine.tick;
      }
    }
  }
</script>

<div class="tickets-view">
  <header class="view-header">
    <h2>INCIDENT TICKETS</h2>
    <div class="stats">
      <span class="stat">OPEN: {openTickets.length + inProgressTickets.length}</span>
      <span class="stat muted">RESOLVED: {resolvedTickets.length}</span>
    </div>
  </header>

  <div class="ticket-columns">
    <section class="column">
      <h3>OPEN ({openTickets.length})</h3>
      <div class="ticket-list">
        {#each openTickets as ticket}
          <div class="ticket-card open">
            <div class="ticket-header">
              <span class="id">#{ticket.id}</span>
              <span class="time">T+{ticket.createdAt}</span>
            </div>
            <h4>{ticket.title}</h4>
            <p>{ticket.description}</p>
            <div class="actions">
              <button onclick={() => updateStatus(ticket, 'investigating')}>ACKNOWLEDGE</button>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="column">
      <h3>INVESTIGATING ({inProgressTickets.length})</h3>
      <div class="ticket-list">
        {#each inProgressTickets as ticket}
          <div class="ticket-card investigating">
            <div class="ticket-header">
              <span class="id">#{ticket.id}</span>
              <span class="time">T+{ticket.createdAt}</span>
            </div>
            <h4>{ticket.title}</h4>
            <div class="actions">
              <button onclick={() => updateStatus(ticket, 'resolved')}>MARK RESOLVED</button>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="column">
      <h3>RESOLVED ({resolvedTickets.length})</h3>
      <div class="ticket-list">
        {#each resolvedTickets as ticket}
          <div class="ticket-card resolved">
            <div class="ticket-header">
              <span class="id">#{ticket.id}</span>
              <span class="time">Resolved @ T+{ticket.resolvedAt}</span>
            </div>
            <h4>{ticket.title}</h4>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .tickets-view {
    padding: 1.5rem;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    border-bottom: 2px solid #222;
    padding-bottom: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    letter-spacing: 0.1em;
  }

  .stats {
    display: flex;
    gap: 1.5rem;
    font-size: 0.9rem;
    font-weight: bold;
  }
  .stat {
    color: #f87171;
  }
  .stat.muted {
    color: #666;
  }

  .ticket-columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    flex: 1;
    overflow: hidden;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: #0a0a0a;
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid #1a1a1a;
  }

  h3 {
    margin: 0;
    font-size: 0.8rem;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .ticket-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .ticket-card {
    background: #111;
    border: 1px solid #222;
    border-radius: 4px;
    padding: 1rem;
    border-left: 4px solid #444;
  }

  .ticket-card.open {
    border-left-color: #f87171;
  }
  .ticket-card.investigating {
    border-left-color: #fbbf24;
  }
  .ticket-card.resolved {
    border-left-color: #4ade80;
    opacity: 0.6;
  }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    margin-bottom: 0.5rem;
    color: #666;
  }

  h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
    color: #eee;
  }
  p {
    margin: 0 0 1rem 0;
    font-size: 0.8rem;
    color: #888;
    line-height: 1.4;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  button {
    background: #222;
    border: 1px solid #333;
    color: #aaa;
    padding: 0.3rem 0.6rem;
    font-size: 0.7rem;
    font-family: inherit;
    font-weight: bold;
    cursor: pointer;
    border-radius: 2px;
  }

  button:hover {
    background: #333;
    color: #fff;
  }

  @media (max-width: 768px) {
    .tickets-view {
      height: auto;
    }

    .ticket-columns {
      grid-template-columns: 1fr;
      overflow: visible;
    }

    .ticket-list {
      overflow-y: visible;
      padding-right: 0;
      max-height: none;
    }

    button {
      padding: 0.55rem 1rem;
      font-size: 0.8rem;
    }
  }
</style>
