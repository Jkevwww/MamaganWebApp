async function loadMe() {
  const pre = document.getElementById('me');
  const logoutBtn = document.getElementById('logoutBtn');

  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (!res.ok) {
      pre.textContent = 'Not signed in.';
      logoutBtn.style.display = 'none';
      return;
    }

    const data = await res.json();
    pre.textContent = JSON.stringify(data.user, null, 2);
    logoutBtn.style.display = 'inline-flex';
  } catch (e) {
    pre.textContent = 'Error loading account status.';
  }
}

loadMe();

