(function () {
  const STORAGE_KEY = 'mamagan_chat_history';
  const MAX_HISTORY = 8;

  const starterMessages = [
    'How do I book a facility?',
    'What payment options are available?',
    'Where can I find my QR ticket?',
  ];

  function createIcon(name) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', name);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  }

  function appendMessage(list, role, content) {
    const item = document.createElement('div');
    item.className = `chatbot-message chatbot-message--${role}`;
    item.textContent = content;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
  }

  function setBusy(form, input, submitButton, busy) {
    input.disabled = busy;
    submitButton.disabled = busy;
    form.classList.toggle('chatbot-form--busy', busy);
  }

  async function sendMessage(history, message) {
    const nextHistory = [...history, { role: 'user', content: message }].slice(-MAX_HISTORY);
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ messages: nextHistory }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'The assistant is unavailable right now.');
    }

    return {
      reply: data.reply || 'I could not generate a response right now.',
      history: [...nextHistory, { role: 'assistant', content: data.reply || '' }].slice(-MAX_HISTORY),
    };
  }

  function initChatbot() {
    if (document.querySelector('[data-chatbot-root]')) return;

    let history = loadHistory();

    const root = document.createElement('div');
    root.className = 'chatbot-root';
    root.dataset.chatbotRoot = 'true';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'chatbot-toggle';
    toggle.setAttribute('aria-label', 'Open Mamagan assistant');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.append(createIcon('message-circle'));

    const panel = document.createElement('section');
    panel.className = 'chatbot-panel';
    panel.setAttribute('aria-label', 'Mamagan AI assistant');
    panel.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.className = 'chatbot-header';

    const titleWrap = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.className = 'chatbot-kicker';
    kicker.textContent = 'AI Assistant';
    const title = document.createElement('h2');
    title.textContent = 'Mamagan Help';
    titleWrap.append(kicker, title);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'chatbot-close';
    closeButton.setAttribute('aria-label', 'Close Mamagan assistant');
    closeButton.append(createIcon('x'));
    header.append(titleWrap, closeButton);

    const messages = document.createElement('div');
    messages.className = 'chatbot-messages';
    messages.setAttribute('aria-live', 'polite');

    const intro = document.createElement('div');
    intro.className = 'chatbot-message chatbot-message--assistant';
    intro.textContent = 'Hi. Ask me about bookings, facilities, payments, or QR tickets.';
    messages.appendChild(intro);
    history.forEach((message) => appendMessage(messages, message.role, message.content));

    const starters = document.createElement('div');
    starters.className = 'chatbot-starters';

    const status = document.createElement('p');
    status.className = 'chatbot-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const form = document.createElement('form');
    form.className = 'chatbot-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'message';
    input.placeholder = 'Ask a question...';
    input.autocomplete = 'off';
    input.maxLength = 600;
    input.setAttribute('aria-label', 'Message for Mamagan assistant');

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.setAttribute('aria-label', 'Send message');
    submitButton.append(createIcon('send'));

    starterMessages.forEach((starter) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = starter;
      button.addEventListener('click', () => {
        input.value = starter;
        form.requestSubmit();
      });
      starters.appendChild(button);
    });

    form.append(input, submitButton);
    panel.append(header, messages, starters, status, form);
    root.append(panel, toggle);
    document.body.appendChild(root);

    function setOpen(open) {
      root.classList.toggle('chatbot-root--open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close Mamagan assistant' : 'Open Mamagan assistant');
      panel.setAttribute('aria-hidden', String(!open));
      if (open) input.focus();
    }

    toggle.addEventListener('click', () => setOpen(!root.classList.contains('chatbot-root--open')));
    closeButton.addEventListener('click', () => setOpen(false));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;

      input.value = '';
      status.textContent = 'Thinking...';
      appendMessage(messages, 'user', message);
      setBusy(form, input, submitButton, true);

      try {
        const result = await sendMessage(history, message);
        history = result.history;
        saveHistory(history);
        appendMessage(messages, 'assistant', result.reply);
        status.textContent = '';
      } catch (err) {
        appendMessage(messages, 'assistant', err.message);
        status.textContent = '';
      } finally {
        setBusy(form, input, submitButton, false);
        input.focus();
      }
    });

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
