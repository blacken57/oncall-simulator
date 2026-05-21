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

  function getSeverity(ticket: Ticket) {
    const titleLower = ticket.title.toLowerCase();
    const descLower = ticket.description.toLowerCase();
    if (titleLower.includes('critical') || descLower.includes('critical')) {
      return {
        code: 'SEV-1',
        label: 'CRITICAL INCIDENT',
        class: 'sev-1'
      };
    } else if (
      titleLower.includes('warning') ||
      titleLower.includes('alert') ||
      descLower.includes('warning') ||
      descLower.includes('alert')
    ) {
      return {
        code: 'SEV-2',
        label: 'WARNING ALERT',
        class: 'sev-2'
      };
    } else {
      return {
        code: 'SEV-3',
        label: 'INFO / PLAN',
        class: 'sev-3'
      };
    }
  }
</script>

<div class="tickets-view">
  <header class="view-header">
    <div class="title-row">
      <span class="bell-icon animate-flicker">🚨</span>
      <h2>INCIDENT telemetry</h2>
    </div>
    <div class="stats">
      <span class="stat sev-1-count"
        >SEV-1: {tickets.filter((t) => getSeverity(t).code === 'SEV-1' && t.status !== 'resolved')
          .length}</span
      >
      <span class="stat sev-2-count"
        >SEV-2: {tickets.filter((t) => getSeverity(t).code === 'SEV-2' && t.status !== 'resolved')
          .length}</span
      >
      <span class="stat sev-3-count"
        >SEV-3: {tickets.filter((t) => getSeverity(t).code === 'SEV-3' && t.status !== 'resolved')
          .length}</span
      >
      <span class="stat resolved-count">RESOLVED: {resolvedTickets.length}</span>
    </div>
  </header>

  <div class="ticket-columns">
    <section class="column col-open">
      <div class="column-header">
        <div class="col-title-group">
          <span class="pulse-ring"></span>
          <h3>ACTIVE ALERTS</h3>
        </div>
        <span class="column-badge">{openTickets.length}</span>
      </div>
      <div class="ticket-list">
        {#each openTickets as ticket}
          {@const sev = getSeverity(ticket)}
          <div class="ticket-card open {sev.class}">
            <div class="ticket-header">
              <span class="id">#{ticket.id}</span>
              <span class="time">T+{ticket.createdAt}s</span>
            </div>
            <h4>{ticket.title}</h4>
            <p>{ticket.description}</p>
            <div class="meta-row">
              <span class="sev-badge {sev.class}">{sev.code}</span>
              {#if ticket.componentId}
                <span class="comp-badge">{ticket.componentId}</span>
              {/if}
            </div>
            <div class="actions">
              <button
                class="ack-btn"
                onclick={() => updateStatus(ticket, 'investigating')}
                aria-label="Acknowledge ticket: {ticket.title}">ACKNOWLEDGE</button
              >
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="column col-investigating">
      <div class="column-header">
        <div class="col-title-group">
          <span class="pulse-ring warning"></span>
          <h3>INVESTIGATING</h3>
        </div>
        <span class="column-badge warning">{inProgressTickets.length}</span>
      </div>
      <div class="ticket-list">
        {#each inProgressTickets as ticket}
          {@const sev = getSeverity(ticket)}
          <div class="ticket-card investigating {sev.class}">
            <div class="ticket-header">
              <span class="id">#{ticket.id}</span>
              <span class="time">T+{ticket.createdAt}s</span>
            </div>
            <h4>{ticket.title}</h4>
            <p>{ticket.description}</p>
            <div class="meta-row">
              <span class="sev-badge {sev.class}">{sev.code}</span>
              {#if ticket.componentId}
                <span class="comp-badge">{ticket.componentId}</span>
              {/if}
            </div>
            <div class="actions">
              <button
                class="resolve-btn"
                onclick={() => updateStatus(ticket, 'resolved')}
                aria-label="Mark resolved: {ticket.title}">RESOLVE</button
              >
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="column col-resolved">
      <div class="column-header">
        <div class="col-title-group">
          <span class="pulse-ring success"></span>
          <h3>RESOLVED SYSLOG</h3>
        </div>
        <span class="column-badge success">{resolvedTickets.length}</span>
      </div>
      <div class="ticket-list">
        {#each resolvedTickets as ticket}
          {@const sev = getSeverity(ticket)}
          <div class="ticket-card resolved">
            <div class="ticket-header">
              <span class="id">#{ticket.id}</span>
              <span class="time">Resolved @ T+{ticket.resolvedAt}s</span>
            </div>
            <h4>{ticket.title}</h4>
            <div class="meta-row">
              <span class="sev-badge resolved">CLEARED</span>
              {#if ticket.componentId}
                <span class="comp-badge">{ticket.componentId}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .tickets-view {
    padding: 1.25rem;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.75rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .bell-icon {
    font-size: 1.1rem;
  }

  h2 {
    margin: 0;
    font-size: 0.85rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-weight: bold;
  }

  .stats {
    display: flex;
    gap: 1rem;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    font-weight: bold;
  }

  .stat {
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    background: var(--bg-deep);
    border: 1px solid var(--border);
  }

  .sev-1-count {
    color: var(--critical);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .sev-2-count {
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.2);
  }

  .sev-3-count {
    color: #3b82f6;
    border-color: rgba(59, 130, 246, 0.2);
  }

  .resolved-count {
    color: var(--success);
    border-color: rgba(16, 185, 129, 0.2);
  }

  .ticket-columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
    flex: 1;
    overflow: hidden;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    background: var(--bg-deep);
    border-radius: var(--radius-md);
    padding: 1rem;
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
  }

  .col-title-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .pulse-ring {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--critical);
    box-shadow: 0 0 6px var(--critical);
  }

  .pulse-ring.warning {
    background: var(--warning);
    box-shadow: 0 0 6px var(--warning);
  }

  .pulse-ring.success {
    background: var(--success);
    box-shadow: 0 0 6px var(--success);
  }

  h3 {
    margin: 0;
    font-size: 0.7rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: var(--font-mono);
    font-weight: bold;
  }

  .column-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: bold;
    background: rgba(239, 68, 68, 0.1);
    color: var(--critical);
    padding: 0.05rem 0.35rem;
    border-radius: 10px;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .column-badge.warning {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.2);
  }

  .column-badge.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success);
    border-color: rgba(16, 185, 129, 0.2);
  }

  .ticket-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    overflow-y: auto;
    padding-right: 0.25rem;
    flex: 1;
  }

  /* Scrollbars customization */
  .ticket-list::-webkit-scrollbar {
    width: 4px;
  }
  .ticket-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .ticket-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }
  .ticket-list::-webkit-scrollbar-thumb:hover {
    background: var(--border-strong);
  }

  .ticket-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.85rem;
    border-left: 3px solid var(--text-faint);
    transition: all 0.25s ease;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ticket-card:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .ticket-card.sev-1 {
    border-left-color: var(--critical);
  }

  .ticket-card.sev-1.open {
    animation: sev1-pulse 2s infinite alternate;
  }

  .ticket-card.sev-2 {
    border-left-color: var(--warning);
  }

  .ticket-card.sev-3 {
    border-left-color: #3b82f6;
  }

  .ticket-card.resolved {
    border-left-color: var(--success);
    opacity: 0.45;
  }

  .ticket-card.resolved:hover {
    opacity: 0.85;
  }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.6rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .id {
    font-weight: bold;
    color: var(--text-secondary);
  }

  h4 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
  }

  p {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .meta-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.15rem;
  }

  .sev-badge {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: bold;
    padding: 0.05rem 0.35rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .sev-badge.sev-1 {
    color: var(--critical);
    background: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .sev-badge.sev-2 {
    color: var(--warning);
    background: rgba(245, 158, 11, 0.05);
    border-color: rgba(245, 158, 11, 0.2);
  }

  .sev-badge.sev-3 {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .sev-badge.resolved {
    color: var(--success);
    background: rgba(16, 185, 129, 0.05);
    border-color: rgba(16, 185, 129, 0.2);
  }

  .comp-badge {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    color: var(--text-muted);
    background: var(--bg-deep);
    padding: 0.05rem 0.35rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  button {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    text-align: center;
    letter-spacing: 0.02em;
  }

  .ack-btn {
    background: rgba(239, 68, 68, 0.08);
    color: var(--critical);
    border-color: rgba(239, 68, 68, 0.25);
  }

  .ack-btn:hover {
    background: var(--critical);
    color: var(--text-primary);
    box-shadow: 0 0 8px var(--critical-glow);
  }

  .resolve-btn {
    background: rgba(245, 158, 11, 0.08);
    color: var(--warning);
    border-color: rgba(245, 158, 11, 0.25);
  }

  .resolve-btn:hover {
    background: var(--warning);
    color: var(--text-primary);
    box-shadow: 0 0 8px var(--warning-glow);
  }

  @keyframes sev1-pulse {
    0% {
      border-color: rgba(239, 68, 68, 0.4);
      box-shadow: 0 0 4px rgba(239, 68, 68, 0.1);
    }
    100% {
      border-color: rgba(239, 68, 68, 1);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.25);
    }
  }

  .animate-flicker {
    animation: flicker 4s infinite alternate;
  }

  @keyframes flicker {
    0%,
    90%,
    94%,
    98%,
    100% {
      opacity: 1;
    }
    92%,
    96% {
      opacity: 0.7;
    }
  }

  @media (max-width: 1024px) {
    .tickets-view {
      height: auto;
    }

    .ticket-columns {
      grid-template-columns: 1fr;
      overflow: visible;
      gap: 1rem;
    }

    .ticket-list {
      overflow-y: visible;
      padding-right: 0;
      max-height: 400px;
    }

    .column {
      max-height: 500px;
    }
  }
</style>
