(function () {
  const POLL_MS = 9000;

  function createIcon(name) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', name);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function appendMessage(list, message) {
    const item = document.createElement('div');
    const roleClass = message.sender_type === 'USER' ? 'user' : 'assistant';
    item.className = `chatbot-message chatbot-message--${roleClass}`;
    item.textContent = message.message;
    list.appendChild(item);
  }

  function renderMessages(list, messages) {
    list.innerHTML = '';
    if (!messages.length) {
      const empty = document.createElement('div');
      empty.className = 'chatbot-message chatbot-message--assistant';
      empty.textContent = 'Send your question and the admin team can reply here.';
      list.appendChild(empty);
      return;
    }

    messages.forEach((message) => appendMessage(list, message));
    list.scrollTop = list.scrollHeight;
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
    if (!response.ok) {
      const err = new Error(data.message || 'Request failed.');
      err.status = response.status;
      throw err;
    }
    return data;
  }

  function setBusy(form, input, submitButton, busy) {
    input.disabled = busy;
    submitButton.disabled = busy;
    form.classList.toggle('chatbot-form--busy', busy);
  }

  function initChatbot() {
    if (document.querySelector('[data-chatbot-root]')) return;

    let isAuthenticated = false;
    let pollTimer = null;

    const root = document.createElement('div');
    root.className = 'chatbot-root';
    root.dataset.chatbotRoot = 'true';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'chatbot-toggle';
    toggle.setAttribute('aria-label', 'Open admin chat');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.append(createIcon('message-circle'));

    const panel = document.createElement('section');
    panel.className = 'chatbot-panel';
    panel.setAttribute('aria-label', 'Message Mamagan admin');
    panel.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.className = 'chatbot-header';

    const titleWrap = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.className = 'chatbot-kicker';
    kicker.textContent = 'Admin Chat';
    const title = document.createElement('h2');
    title.textContent = 'Message Mamagan';
    titleWrap.append(kicker, title);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'chatbot-close';
    closeButton.setAttribute('aria-label', 'Close admin chat');
    closeButton.append(createIcon('x'));
    header.append(titleWrap, closeButton);

    const messages = document.createElement('div');
    messages.className = 'chatbot-messages';
    messages.setAttribute('aria-live', 'polite');

    const status = document.createElement('p');
    status.className = 'chatbot-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const form = document.createElement('form');
    form.className = 'chatbot-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'message';
    input.placeholder = 'Type your question...';
    input.autocomplete = 'off';
    input.maxLength = 1000;
    input.setAttribute('aria-label', 'Message for Mamagan admin');

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.setAttribute('aria-label', 'Send message');
    submitButton.append(createIcon('send'));

    form.append(input, submitButton);
    panel.append(header, messages, status, form);
    root.append(panel, toggle);
    document.body.appendChild(root);

    function setOpen(open) {
      root.classList.toggle('chatbot-root--open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close admin chat' : 'Open admin chat');
      panel.setAttribute('aria-hidden', String(!open));
      if (open) {
        input.focus();
        void loadThread();
      }
    }

    async function loadThread() {
      try {
        const data = await api('/api/chat/thread');
        isAuthenticated = true;
        renderMessages(messages, data.messages || []);
        status.textContent = data.thread?.status === 'CLOSED'
          ? 'This conversation was closed. Sending a new message will reopen it.'
          : '';
        input.disabled = false;
        submitButton.disabled = false;
      } catch (err) {
        isAuthenticated = false;
        renderMessages(messages, []);
        input.disabled = true;
        submitButton.disabled = true;
        status.textContent = err.status === 401
          ? 'Sign in or create an account to message the admin team.'
          : err.message;
      }
    }

    toggle.addEventListener('click', () => setOpen(!root.classList.contains('chatbot-root--open')));
    closeButton.addEventListener('click', () => setOpen(false));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message || !isAuthenticated) return;

      input.value = '';
      status.textContent = 'Sending...';
      setBusy(form, input, submitButton, true);

      try {
        await api('/api/chat/messages', {
          method: 'POST',
          body: JSON.stringify({ message }),
        });
        await loadThread();
        status.textContent = 'Sent to admin.';
      } catch (err) {
        status.textContent = err.message;
      } finally {
        setBusy(form, input, submitButton, false);
        input.focus();
      }
    });

    pollTimer = window.setInterval(() => {
      if (root.classList.contains('chatbot-root--open')) {
        void loadThread();
      }
    }, POLL_MS);

    window.addEventListener('beforeunload', () => {
      if (pollTimer) window.clearInterval(pollTimer);
    });

    void loadThread();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
