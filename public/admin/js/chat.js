(function () {
  const POLL_MS = 8000;

  const state = {
    threads: [],
    selectedThreadId: null,
    selectedThread: null,
    messages: [],
  };

  const els = {
    alert: document.getElementById('chatAlert'),
    search: document.getElementById('chatSearch'),
    statusFilter: document.getElementById('chatStatusFilter'),
    threadList: document.getElementById('chatThreadList'),
    clientName: document.getElementById('chatClientName'),
    clientMeta: document.getElementById('chatClientMeta'),
    statusToggle: document.getElementById('chatStatusToggle'),
    messageList: document.getElementById('chatMessageList'),
    form: document.getElementById('adminChatForm'),
    input: document.getElementById('adminChatInput'),
    send: document.getElementById('adminChatSend'),
  };

  function showAlert(message, type = 'error') {
    if (!els.alert) return;
    els.alert.textContent = message;
    els.alert.className = `dashboard-alert dashboard-alert-${type}`;
  }

  function hideAlert() {
    if (!els.alert) return;
    els.alert.textContent = '';
    els.alert.className = 'dashboard-alert is-hidden';
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed.');
    return data;
  }

  function formatDate(value) {
    if (!value) return 'No messages yet';
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  function filteredThreads() {
    const query = String(els.search?.value || '').trim().toLowerCase();
    const status = String(els.statusFilter?.value || '').trim().toUpperCase();

    return state.threads.filter((thread) => {
      const matchesStatus = !status || thread.status === status;
      const text = `${thread.user_name || ''} ${thread.user_email || ''} ${thread.user_phone || ''}`.toLowerCase();
      const matchesQuery = !query || text.includes(query);
      return matchesStatus && matchesQuery;
    });
  }

  function renderThreads() {
    const threads = filteredThreads();
    els.threadList.innerHTML = '';

    if (!threads.length) {
      els.threadList.innerHTML = '<div class="admin-chat-empty">No conversations found.</div>';
      return;
    }

    threads.forEach((thread) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `admin-chat-thread ${thread.id === state.selectedThreadId ? 'is-active' : ''}`;
      button.dataset.threadId = thread.id;

      const unread = Number(thread.unread_count || 0);
      const top = document.createElement('span');
      top.className = 'admin-chat-thread-top';
      const name = document.createElement('strong');
      name.textContent = thread.user_name || 'Client';
      top.appendChild(name);
      if (unread) {
        const badge = document.createElement('span');
        badge.className = 'admin-chat-unread';
        badge.textContent = String(unread);
        top.appendChild(badge);
      }

      const preview = document.createElement('span');
      preview.className = 'admin-chat-thread-preview';
      preview.textContent = thread.last_message || 'No messages yet';

      const meta = document.createElement('span');
      meta.className = 'admin-chat-thread-meta';
      const status = document.createElement('span');
      status.textContent = thread.status;
      const date = document.createElement('span');
      date.textContent = formatDate(thread.last_message_created_at || thread.last_message_at || thread.created_at);
      meta.append(status, date);

      button.append(top, preview, meta);
      button.addEventListener('click', () => selectThread(thread.id));
      els.threadList.appendChild(button);
    });
  }

  function renderMessages() {
    els.messageList.innerHTML = '';

    if (!state.selectedThread) {
      els.messageList.innerHTML = '<div class="admin-chat-empty">Choose a client thread to view messages.</div>';
      return;
    }

    if (!state.messages.length) {
      els.messageList.innerHTML = '<div class="admin-chat-empty">No messages in this conversation yet.</div>';
      return;
    }

    state.messages.forEach((message) => {
      const item = document.createElement('div');
      item.className = `admin-chat-message admin-chat-message-${message.sender_type === 'ADMIN' ? 'admin' : 'client'}`;
      item.innerHTML = `
        <div class="admin-chat-message-bubble">
          <p>${escapeHtml(message.message)}</p>
          <span>${message.sender_name || (message.sender_type === 'ADMIN' ? 'Admin' : 'Client')} · ${formatDate(message.created_at)}</span>
        </div>
      `;
      els.messageList.appendChild(item);
    });

    els.messageList.scrollTop = els.messageList.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderConversationHeader() {
    const thread = state.selectedThread;
    if (!thread) {
      els.clientName.textContent = 'Select a conversation';
      els.clientMeta.textContent = 'Client details will appear here.';
      els.statusToggle.disabled = true;
      els.input.disabled = true;
      els.send.disabled = true;
      return;
    }

    els.clientName.textContent = thread.user_name || 'Client';
    els.clientMeta.textContent = [thread.user_email, thread.user_phone].filter(Boolean).join(' · ') || 'No contact details';
    els.statusToggle.disabled = false;
    els.statusToggle.querySelector('span').textContent = thread.status === 'CLOSED' ? 'Reopen' : 'Close';
    els.input.disabled = false;
    els.send.disabled = false;
  }

  async function loadThreads({ keepSelection = true } = {}) {
    const data = await api('/api/chat/admin/threads');
    state.threads = data.threads || [];

    if (!keepSelection || !state.threads.some((thread) => thread.id === state.selectedThreadId)) {
      state.selectedThreadId = state.threads[0]?.id || null;
    }

    renderThreads();

    if (state.selectedThreadId) {
      await loadMessages(state.selectedThreadId);
    } else {
      state.selectedThread = null;
      state.messages = [];
      renderConversationHeader();
      renderMessages();
    }
  }

  async function loadMessages(threadId) {
    const data = await api(`/api/chat/admin/threads/${threadId}/messages`);
    state.selectedThreadId = threadId;
    state.selectedThread = data.thread;
    state.messages = data.messages || [];
    renderConversationHeader();
    renderMessages();
    renderThreads();
  }

  async function selectThread(threadId) {
    hideAlert();
    await loadMessages(threadId);
  }

  els.search?.addEventListener('input', renderThreads);
  els.statusFilter?.addEventListener('change', renderThreads);

  els.statusToggle?.addEventListener('click', async () => {
    if (!state.selectedThread) return;
    const status = state.selectedThread.status === 'CLOSED' ? 'OPEN' : 'CLOSED';
    try {
      const data = await api(`/api/chat/admin/threads/${state.selectedThread.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      state.selectedThread = data.thread;
      await loadThreads();
    } catch (err) {
      showAlert(err.message);
    }
  });

  els.form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = els.input.value.trim();
    if (!message || !state.selectedThread) return;

    els.input.value = '';
    els.input.disabled = true;
    els.send.disabled = true;

    try {
      await api(`/api/chat/admin/threads/${state.selectedThread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      await loadThreads();
    } catch (err) {
      showAlert(err.message);
    } finally {
      els.input.disabled = false;
      els.send.disabled = false;
      els.input.focus();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
  });

  loadThreads({ keepSelection: false }).catch((err) => showAlert(err.message));
  window.setInterval(() => {
    loadThreads().catch(() => {});
  }, POLL_MS);
})();
