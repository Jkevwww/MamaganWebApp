/**
 * Manage Facilities CRUD Logic
 */

(function () {
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };
  const skeleton = window.Skeleton;

  let allFacilities = [];

  async function loadFacilities() {
    const tbody = document.getElementById('facilitiesTbody');
    if (skeleton) skeleton.renderTableSkeleton(tbody, 7, 6);

    const search = document.getElementById('facilitySearch').value;
    const category = document.getElementById('categoryFilter').value;

    let url = '/api/admin/facilities?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (category) url += `category=${category}&`;

    try {
      const res = await fetch(url, { headers: authHeader });
      allFacilities = await res.json();
      renderFacilities(allFacilities);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--error); padding:2rem;">Error: ${err.message}</td></tr>`;
    }
  }

  function renderFacilities(facilities) {
    const tbody = document.getElementById('facilitiesTbody');
    if (facilities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:2rem; color:#94a3b8;">No facilities found.</td></tr>';
      return;
    }

    tbody.innerHTML = facilities.map(f => `
      <tr>
        <td><img src="${f.image_url || '/mamagan-logo.svg'}" style="width:50px; height:50px; object-fit:cover; border-radius:6px;"></td>
        <td>
          <div style="font-weight:600;">${escHtml(f.name)}</div>
          <div style="font-size:0.75rem; color:#64748b;">${escHtml(f.size)}</div>
        </td>
        <td><span class="badge" style="background:#f1f5f9; color:#64748b;">${f.category}</span></td>
        <td>
           <div style="font-weight:600;">₱${(f.day_rate_min || f.price_min || 0).toLocaleString()}</div>
           <div style="font-size:0.7rem; color:#94a3b8;">${f.rental_type}</div>
        </td>
        <td>${f.inventory_count} unit(s)</td>
        <td>
          <span class="badge ${f.active ? 'status-approved' : 'status-cancelled'}">${f.active ? 'ACTIVE' : 'INACTIVE'}</span>
          ${!f.bookable ? '<br><small style="color:var(--error); font-size:10px;">UNBOOKABLE</small>' : ''}
        </td>
        <td>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn-sm btn-approve" onclick="editFacility(${f.id})" title="Edit"><i data-lucide="edit-2" style="width:14px;"></i></button>
            <button class="btn-sm btn-cancel" onclick="deleteFacility(${f.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    
    if (window.lucide) lucide.createIcons();
  }

  // --- Modal Logic ---
  const modal = document.getElementById('facilityModal');
  const form = document.getElementById('facilityForm');

  document.getElementById('addFacilityBtn').addEventListener('click', () => {
    form.reset();
    document.getElementById('facilityId').value = '';
    document.getElementById('modalTitle').textContent = 'Add New Facility';
    document.getElementById('imagePreview').style.display = 'none';
    modal.classList.add('open');
  });

  window.editFacility = async (id) => {
    const f = allFacilities.find(item => item.id === id);
    if (!f) return;

    form.reset();
    document.getElementById('facilityId').value = f.id;
    document.getElementById('modalTitle').textContent = 'Edit Facility';
    
    // Fill fields
    document.getElementById('name').value = f.name;
    document.getElementById('category').value = f.category;
    document.getElementById('size').value = f.size || '';
    document.getElementById('description').value = f.description || '';
    document.getElementById('inventory_count').value = f.inventory_count;
    document.getElementById('rental_type').value = f.rental_type;
    document.getElementById('capacity_min').value = f.capacity_min;
    document.getElementById('capacity_max').value = f.capacity_max;
    
    // Rate fields
    document.getElementById('day_rate_min').value = f.day_rate_min || 0;
    document.getElementById('day_rate_max').value = f.day_rate_max || 0;
    document.getElementById('night_surcharge_min').value = f.night_surcharge_min || 0;
    document.getElementById('night_surcharge_max').value = f.night_surcharge_max || 0;
    document.getElementById('hourly_rate').value = f.hourly_rate || 0;
    document.getElementById('daily_rate').value = f.daily_rate || 0;

    document.getElementById('image_url').value = f.image_url || '';
    document.getElementById('active').checked = !!f.active;
    document.getElementById('bookable').checked = !!f.bookable;
    document.getElementById('restricted_during_peak_hours').checked = !!f.restricted_during_peak_hours;
    document.getElementById('unavailable_reason').value = f.unavailable_reason || '';

    if (f.image_url) {
      document.getElementById('imagePreview').src = f.image_url;
      document.getElementById('imagePreview').style.display = 'block';
    }

    modal.classList.add('open');
  };

  window.deleteFacility = async (id) => {
    if (!confirm('Are you sure you want to delete this facility? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/facilities/${id}`, { method: 'DELETE', headers: authHeader });
      if (res.ok) {
        alert('Facility deleted successfully');
        loadFacilities();
      } else {
        const data = await res.json();
        throw new Error(data.message);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  document.getElementById('closeModal').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('cancelBtn').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('facilityId').value;
    const formData = new FormData(form);
    
    // Ensure 1 or 0 for checkboxes
    formData.set('active', document.getElementById('active').checked ? '1' : '0');
    formData.set('bookable', document.getElementById('bookable').checked ? '1' : '0');
    formData.set('restricted_during_peak_hours', document.getElementById('restricted_during_peak_hours').checked ? '1' : '0');

    // Compatibility: set price_min/max based on day_rate or hourly
    const category = formData.get('category');
    if (category === 'BEACH_EQUIPMENT') {
       formData.set('price_min', formData.get('hourly_rate'));
       formData.set('price_max', formData.get('daily_rate'));
    } else {
       formData.set('price_min', formData.get('day_rate_min'));
       formData.set('price_max', formData.get('day_rate_max'));
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/facilities/${id}` : '/api/admin/facilities';

    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        alert(`Facility ${id ? 'updated' : 'created'} successfully`);
        modal.classList.remove('open');
        loadFacilities();
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Operation failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  // Image Preview
  document.getElementById('image_file').addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  // Search & Filter
  let searchTimeout;
  document.getElementById('facilitySearch').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadFacilities, 400);
  });
  document.getElementById('categoryFilter').addEventListener('change', loadFacilities);

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  loadFacilities();
})();
