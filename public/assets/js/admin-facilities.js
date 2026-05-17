(function () {
  const API_BASE = '/api/admin/facilities';
  const DEFAULT_IMAGE = '/assets/images/cottage.jpg';
  const DELETE_LOTTIE_URL = 'https://lottie.host/embed/218949da-56b9-495b-ad6c-6f19de6d32e4/Av64mblLSy.lottie';
  const CONFIRM_LOTTIE_URL = 'https://lottie.host/embed/b2fee4e8-7844-428a-adcc-3c8f7f698ef7/PxVN7fb25I.lottie';

  const state = {
    facilities: [],
    loading: false,
    editingId: null,
    actionConfirmResolver: null,
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    [
      'facilityAlert', 'facilitySearch', 'categoryFilter', 'sizeFilter', 'activeFilter', 'bookableFilter',
      'adminFilterToggle', 'adminFiltersPanel', 'applyAdminFilters', 'resetAdminFilters',
      'deleteConfirmModal', 'deleteConfirmLottie', 'deleteConfirmTitle', 'deleteConfirmMessage',
      'deleteSuccessModal', 'deleteSuccessLottie', 'deleteSuccessTitle', 'deleteSuccessMessage',
      'cancelDeleteBtn', 'confirmDeleteBtn', 'deleteSuccessOkBtn',
      'facilitiesTbody', 'facilityModal', 'facilityForm', 'facilityId', 'modalTitle', 'modalSubtitle',
      'addFacilityBtn', 'closeModal', 'cancelBtn', 'saveBtn', 'uploadImageBtn', 'clearImageBtn',
      'name', 'category', 'size', 'description', 'image_url', 'image_file', 'imagePreview',
      'inventory_count', 'capacity_min', 'capacity_max', 'price_min', 'price_max',
      'day_rate_min', 'day_rate_max', 'night_surcharge_min', 'night_surcharge_max',
      'hourly_rate', 'daily_rate', 'rental_type', 'active', 'bookable',
      'restricted_during_peak_hours', 'unavailable_reason',
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });

    bindEvents();
    updateCategoryFields();
    loadFacilities();
    if (window.lucide) lucide.createIcons();
  }

  function bindEvents() {
    els.addFacilityBtn.addEventListener('click', openAddModal);
    els.closeModal.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);
    els.facilityModal.addEventListener('click', (event) => {
      if (event.target === els.facilityModal) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && els.facilityModal.classList.contains('open')) closeModal();
      if (event.key === 'Escape' && els.deleteConfirmModal.classList.contains('open')) closeDeleteConfirm(false);
    });

    let searchTimer;
    els.facilitySearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadFacilities, 250);
    });
    [els.categoryFilter, els.sizeFilter, els.activeFilter, els.bookableFilter].forEach((el) => {
      el.addEventListener('change', loadFacilities);
    });
    els.adminFilterToggle.addEventListener('click', toggleFiltersPanel);
    els.applyAdminFilters.addEventListener('click', () => {
      closeFiltersPanel();
      loadFacilities();
    });
    els.resetAdminFilters.addEventListener('click', resetFilters);
    document.addEventListener('click', (event) => {
      if (!els.adminFiltersPanel.classList.contains('open')) return;
      if (els.adminFiltersPanel.contains(event.target) || els.adminFilterToggle.contains(event.target)) return;
      closeFiltersPanel();
    });

    els.category.addEventListener('change', updateCategoryFields);
    els.bookable.addEventListener('change', updateCategoryFields);
    els.image_url.addEventListener('input', () => setPreview(els.image_url.value));
    els.image_file.addEventListener('change', previewSelectedFile);
    els.clearImageBtn.addEventListener('click', clearImage);
    els.uploadImageBtn.addEventListener('click', uploadImageOnly);
    els.facilityForm.addEventListener('submit', submitFacility);
    els.cancelDeleteBtn.addEventListener('click', () => closeDeleteConfirm(false));
    els.confirmDeleteBtn.addEventListener('click', () => closeDeleteConfirm(true));
    els.deleteConfirmModal.addEventListener('click', (event) => {
      if (event.target === els.deleteConfirmModal) closeDeleteConfirm(false);
    });
    els.deleteSuccessOkBtn.addEventListener('click', closeDeleteSuccess);
    els.deleteSuccessModal.addEventListener('click', (event) => {
      if (event.target === els.deleteSuccessModal) closeDeleteSuccess();
    });
  }

  async function loadFacilities() {
    state.loading = true;
    renderLoading();

    const params = new URLSearchParams();
    if (els.facilitySearch.value.trim()) params.set('search', els.facilitySearch.value.trim());
    if (els.categoryFilter.value) params.set('category', els.categoryFilter.value);
    if (els.sizeFilter.value) params.set('size', els.sizeFilter.value);
    if (els.activeFilter.value !== '') params.set('active', els.activeFilter.value);
    if (els.bookableFilter.value !== '') params.set('bookable', els.bookableFilter.value);

    try {
      const facilities = await apiFetch(`${API_BASE}?${params.toString()}`);
      state.facilities = Array.isArray(facilities) ? facilities : [];
      renderFacilities();
    } catch (err) {
      renderError(err.message);
    } finally {
      state.loading = false;
    }
  }

  function toggleFiltersPanel() {
    const isOpen = els.adminFiltersPanel.classList.toggle('open');
    els.adminFilterToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function closeFiltersPanel() {
    els.adminFiltersPanel.classList.remove('open');
    els.adminFilterToggle.setAttribute('aria-expanded', 'false');
  }

  function resetFilters() {
    els.categoryFilter.value = '';
    els.sizeFilter.value = '';
    els.activeFilter.value = '';
    els.bookableFilter.value = '';
    closeFiltersPanel();
    loadFacilities();
  }

  function renderLoading() {
    if (window.Skeleton?.renderTableSkeleton) {
      window.Skeleton.renderTableSkeleton(els.facilitiesTbody, 10, 6);
      return;
    }
    els.facilitiesTbody.innerHTML = '<tr><td colspan="10" class="table-empty">Loading facilities...</td></tr>';
  }

  function renderError(message) {
    els.facilitiesTbody.innerHTML = `
      <tr>
        <td colspan="10" class="facility-state-cell">
          <div class="facility-state facility-state-error">
            <i data-lucide="alert-triangle" aria-hidden="true"></i>
            <strong>Unable to load facilities</strong>
            <span>${escHtml(message)}</span>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
  }

  function renderFacilities() {
    if (!state.facilities.length) {
      els.facilitiesTbody.innerHTML = `
        <tr>
          <td colspan="10" class="facility-state-cell">
            <div class="facility-state">
              <i data-lucide="inbox" aria-hidden="true"></i>
              <strong>No facilities found</strong>
              <span>Try different filters or add a new facility.</span>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    els.facilitiesTbody.innerHTML = state.facilities.map((facility) => `
      <tr>
        <td>
          <img class="admin-facility-thumb" src="${escAttr(facility.image_url || categoryImage(facility.category))}" alt="${escAttr(facility.name)}" onerror="this.onerror=null;this.src='${escAttr(categoryImage(facility.category))}';">
        </td>
        <td>
          <div class="text-strong">${escHtml(facility.name)}</div>
          <div class="facility-thumb-meta">${escHtml(facility.unavailable_reason || '')}</div>
        </td>
        <td><span class="badge badge-muted">${categoryLabel(facility.category)}</span></td>
        <td>${sizeLabel(facility.size)}</td>
        <td>${Number(facility.inventory_count || 0).toLocaleString('en-PH')}</td>
        <td>${formatRate(facility)}</td>
        <td>${formatCapacity(facility)}</td>
        <td>${statusBadge(Boolean(Number(facility.active)), 'Active', 'Inactive')}</td>
        <td>${statusBadge(Boolean(Number(facility.bookable)), 'Bookable', facility.unavailable_reason ? 'Unavailable' : 'Not Bookable')}</td>
        <td>
          <div class="table-action-row">
            <button type="button" class="btn-sm btn-view" data-action="view" data-id="${facility.id}" title="View">
              <img class="action-icon" src="/assets/icons/overview.svg" alt="" aria-hidden="true"><span>View</span>
            </button>
            <button type="button" class="btn-sm btn-approve" data-action="edit" data-id="${facility.id}" title="Edit">
              <img class="action-icon" src="/assets/icons/file-edit.svg" alt="" aria-hidden="true"><span>Edit</span>
            </button>
            <button type="button" class="btn-sm btn-toggle" data-action="toggle" data-id="${facility.id}" title="${Number(facility.active) ? 'Disable' : 'Enable'}">
              <img class="action-icon" src="/assets/icons/ban.svg" alt="" aria-hidden="true"><span>${Number(facility.active) ? 'Disable' : 'Enable'}</span>
            </button>
            <button type="button" class="btn-sm btn-cancel" data-action="delete" data-id="${facility.id}" title="Delete">
              <img class="action-icon" src="/assets/icons/trash.svg" alt="" aria-hidden="true"><span>Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    els.facilitiesTbody.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', handleTableAction);
    });
    if (window.lucide) lucide.createIcons();
  }

  async function handleTableAction(event) {
    const button = event.currentTarget;
    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const facility = state.facilities.find((item) => Number(item.id) === id);
    if (!facility) return;

    if (action === 'view') openViewModal(facility);
    if (action === 'edit') openEditModal(facility);
    if (action === 'toggle') await toggleFacility(facility);
    if (action === 'delete') await deleteFacility(facility);
  }

  function openAddModal() {
    state.editingId = null;
    els.facilityForm.reset();
    els.facilityId.value = '';
    els.modalTitle.textContent = 'Add Facility';
    els.modalSubtitle.textContent = 'Create a database-backed facility.';
    els.category.value = 'COTTAGE';
    els.inventory_count.value = '1';
    els.active.checked = true;
    els.bookable.checked = true;
    els.rental_type.value = 'HOURLY_OR_DAILY';
    els.saveBtn.disabled = false;
    setFormReadonly(false);
    setPreview(DEFAULT_IMAGE);
    updateCategoryFields();
    els.facilityModal.classList.add('open');
  }

  function openEditModal(facility) {
    state.editingId = Number(facility.id);
    fillForm(facility);
    els.modalTitle.textContent = 'Edit Facility';
    els.modalSubtitle.textContent = 'Update facility inventory, rates, image, and statuses.';
    els.saveBtn.disabled = false;
    setFormReadonly(false);
    els.facilityModal.classList.add('open');
  }

  function openViewModal(facility) {
    state.editingId = Number(facility.id);
    fillForm(facility);
    els.modalTitle.textContent = 'View Facility';
    els.modalSubtitle.textContent = 'Read-only facility details.';
    els.saveBtn.disabled = true;
    setFormReadonly(true);
    els.facilityModal.classList.add('open');
  }

  function fillForm(facility) {
    els.facilityForm.reset();
    els.facilityId.value = facility.id;
    els.name.value = facility.name || '';
    els.category.value = facility.category || 'COTTAGE';
    els.size.value = facility.size || '';
    els.description.value = facility.description || '';
    els.image_url.value = facility.image_url || '';
    els.inventory_count.value = facility.inventory_count ?? 0;
    els.capacity_min.value = facility.capacity_min ?? '';
    els.capacity_max.value = facility.capacity_max ?? '';
    els.price_min.value = facility.price_min ?? '';
    els.price_max.value = facility.price_max ?? '';
    els.day_rate_min.value = facility.day_rate_min ?? '';
    els.day_rate_max.value = facility.day_rate_max ?? '';
    els.night_surcharge_min.value = facility.night_surcharge_min ?? '';
    els.night_surcharge_max.value = facility.night_surcharge_max ?? '';
    els.hourly_rate.value = facility.hourly_rate ?? '';
    els.daily_rate.value = facility.daily_rate ?? '';
    els.rental_type.value = facility.rental_type === 'FIXED' ? 'HOURLY_OR_DAILY' : (facility.rental_type || 'HOURLY_OR_DAILY');
    els.active.checked = Boolean(Number(facility.active));
    els.bookable.checked = Boolean(Number(facility.bookable));
    els.restricted_during_peak_hours.checked = Boolean(Number(facility.restricted_during_peak_hours));
    els.unavailable_reason.value = facility.unavailable_reason || '';
    els.image_file.value = '';
    setPreview(facility.image_url || DEFAULT_IMAGE);
    updateCategoryFields();
  }

  function setFormReadonly(readonly) {
    els.facilityForm.querySelectorAll('input, select, textarea, button').forEach((control) => {
      if (['closeModal', 'cancelBtn'].includes(control.id)) return;
      if (control.id === 'saveBtn') return;
      control.disabled = readonly;
    });
  }

  function closeModal() {
    els.facilityModal.classList.remove('open');
    setFormReadonly(false);
    els.saveBtn.disabled = false;
  }

  function updateCategoryFields() {
    const category = els.category.value;
    const groups = {
      size: category !== 'BEACH_EQUIPMENT',
      cottage: category === 'COTTAGE',
      cabana: category === 'CABANA',
      equipment: category === 'BEACH_EQUIPMENT',
    };

    document.querySelectorAll('[data-field-group]').forEach((field) => {
      const group = field.dataset.fieldGroup;
      field.classList.toggle('is-hidden', !groups[group]);
    });

    els.size.required = category !== 'BEACH_EQUIPMENT';
    els.price_min.required = category === 'COTTAGE' && els.bookable.checked;
    els.price_max.required = category === 'COTTAGE' && els.bookable.checked;
    els.capacity_min.required = category === 'CABANA';
    els.capacity_max.required = category === 'CABANA';
    els.day_rate_min.required = category === 'CABANA';
    els.day_rate_max.required = category === 'CABANA';
    els.night_surcharge_min.required = category === 'CABANA';
    els.night_surcharge_max.required = category === 'CABANA';
    els.hourly_rate.required = category === 'BEACH_EQUIPMENT';
    els.daily_rate.required = category === 'BEACH_EQUIPMENT';
    els.rental_type.required = category === 'BEACH_EQUIPMENT';

    if (category === 'COTTAGE') els.rental_type.value = 'HOURLY_OR_DAILY';
    if (category === 'CABANA') els.rental_type.value = 'DAILY';
    if (category === 'BEACH_EQUIPMENT' && !['HOURLY', 'DAILY', 'HOURLY_OR_DAILY'].includes(els.rental_type.value)) {
      els.rental_type.value = 'HOURLY_OR_DAILY';
    }
  }

  async function submitFacility(event) {
    event.preventDefault();
    updateCategoryFields();

    const id = els.facilityId.value;
    const formData = buildFormData();
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/${encodeURIComponent(id)}` : API_BASE;
    const originalText = els.saveBtn.textContent;

    els.saveBtn.disabled = true;
    els.saveBtn.textContent = 'Saving...';

    try {
      await apiFetch(url, { method, body: formData });
      showAlert(`Facility ${id ? 'updated' : 'created'} successfully.`, 'success');
      closeModal();
      await loadFacilities();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = originalText;
      if (window.lucide) lucide.createIcons();
    }
  }

  function buildFormData() {
    const formData = new FormData(els.facilityForm);
    const category = els.category.value;

    formData.set('active', els.active.checked ? '1' : '0');
    formData.set('bookable', els.bookable.checked ? '1' : '0');
    formData.set('restricted_during_peak_hours', els.restricted_during_peak_hours.checked ? '1' : '0');

    if (!els.image_file.files.length) formData.delete('image');

    if (category === 'COTTAGE') {
      formData.set('rental_type', 'FIXED');
      clearFormData(formData, ['capacity_min', 'capacity_max', 'day_rate_min', 'day_rate_max', 'night_surcharge_min', 'night_surcharge_max', 'hourly_rate', 'daily_rate']);
    }
    if (category === 'CABANA') {
      formData.set('rental_type', 'DAILY');
      formData.set('price_min', els.day_rate_min.value);
      formData.set('price_max', els.day_rate_max.value);
      clearFormData(formData, ['hourly_rate', 'daily_rate']);
    }
    if (category === 'BEACH_EQUIPMENT') {
      formData.delete('size');
      formData.set('price_min', els.hourly_rate.value);
      formData.set('price_max', els.daily_rate.value);
      clearFormData(formData, ['capacity_min', 'capacity_max', 'day_rate_min', 'day_rate_max', 'night_surcharge_min', 'night_surcharge_max']);
    }

    return formData;
  }

  function clearFormData(formData, fields) {
    fields.forEach((field) => formData.set(field, ''));
  }

  async function toggleFacility(facility) {
    const nextActive = Number(facility.active) ? 0 : 1;
    const nextBookable = nextActive ? 1 : 0;
    const action = nextActive ? 'enable' : 'disable';
    const confirmed = await confirmFacilityAction({
      title: nextActive ? 'Enable facility?' : 'Disable facility?',
      message: nextActive
        ? `${facility.name} will be visible and available for bookings again.`
        : `${facility.name} will be hidden from new bookings until it is enabled again.`,
      animationUrl: nextActive ? CONFIRM_LOTTIE_URL : DELETE_LOTTIE_URL,
      animationTitle: nextActive ? 'Confirm animation' : 'Delete animation',
      confirmText: nextActive ? 'Enable' : 'Disable',
      danger: !nextActive,
    });
    if (!confirmed) return;

    try {
      await apiFetch(`${API_BASE}/${facility.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: nextActive,
          bookable: nextBookable,
          unavailable_reason: nextActive ? facility.unavailable_reason : (facility.unavailable_reason || 'Currently unavailable'),
        }),
      });
      await loadFacilities();
      openActionSuccess({
        title: nextActive ? 'Enabled' : 'Disabled',
        message: `${facility.name} has been ${action}d successfully.`,
      });
    } catch (err) {
      showAlert(err.message, 'error');
    }
  }

  async function deleteFacility(facility) {
    const confirmed = await confirmFacilityAction({
      title: 'Delete facility?',
      message: `${facility.name} will be permanently deleted.`,
      animationUrl: DELETE_LOTTIE_URL,
      animationTitle: 'Delete animation',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await apiFetch(`${API_BASE}/${facility.id}`, { method: 'DELETE' });
      await loadFacilities();
      openActionSuccess({
        title: 'Deleted',
        message: `${facility.name} has been deleted.`,
      });
    } catch (err) {
      showAlert(err.message, 'error');
    }
  }

  function confirmFacilityAction({ title, message, animationUrl, animationTitle, confirmText, danger }) {
    return new Promise((resolve) => {
      state.actionConfirmResolver = resolve;
      els.deleteConfirmTitle.textContent = title;
      els.deleteConfirmMessage.textContent = message;
      els.deleteConfirmLottie.src = animationUrl;
      els.deleteConfirmLottie.title = animationTitle;
      els.confirmDeleteBtn.textContent = confirmText;
      els.confirmDeleteBtn.className = danger
        ? 'btn btn-primary delete-confirm-button'
        : 'btn btn-primary';
      els.deleteConfirmModal.classList.add('open');
      els.confirmDeleteBtn.disabled = false;
    });
  }

  function closeDeleteConfirm(result = false) {
    els.deleteConfirmModal.classList.remove('open');
    if (state.actionConfirmResolver) {
      state.actionConfirmResolver(result);
      state.actionConfirmResolver = null;
    }
  }

  function openActionSuccess({ title, message }) {
    els.deleteSuccessTitle.textContent = title;
    els.deleteSuccessMessage.textContent = message;
    els.deleteSuccessLottie.src = CONFIRM_LOTTIE_URL;
    els.deleteSuccessLottie.title = 'Confirm animation';
    els.deleteSuccessModal.classList.add('open');
  }

  function closeDeleteSuccess() {
    els.deleteSuccessModal.classList.remove('open');
  }

  async function uploadImageOnly() {
    const id = els.facilityId.value;
    if (!id) {
      showAlert('Save the facility before uploading an image separately.', 'error');
      return;
    }
    if (!els.image_file.files.length && !els.image_url.value.trim()) {
      showAlert('Choose an image file or enter an image URL first.', 'error');
      return;
    }

    const formData = new FormData();
    if (els.image_file.files.length) {
      formData.set('image', els.image_file.files[0]);
    } else {
      formData.set('image_url', els.image_url.value.trim());
    }

    try {
      const result = await apiFetch(`${API_BASE}/${id}/image`, { method: 'POST', body: formData });
      els.image_url.value = result.image_url || '';
      setPreview(result.image_url || DEFAULT_IMAGE);
      showAlert('Facility image updated successfully.', 'success');
      await loadFacilities();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  }

  function clearImage() {
    els.image_url.value = '';
    els.image_file.value = '';
    setPreview(DEFAULT_IMAGE);
  }

  function previewSelectedFile() {
    const file = els.image_file.files[0];
    if (!file) {
      setPreview(els.image_url.value || DEFAULT_IMAGE);
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showAlert('Only JPG, PNG, and WEBP images are allowed.', 'error');
      els.image_file.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showAlert('Image file size must be 5 MB or smaller.', 'error');
      els.image_file.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setPreview(event.target.result);
    reader.readAsDataURL(file);
  }

  function setPreview(src) {
    els.imagePreview.onerror = () => {
      els.imagePreview.onerror = null;
      els.imagePreview.src = categoryImage(els.category.value);
    };
    els.imagePreview.src = src || categoryImage(els.category.value);
    els.imagePreview.classList.add('is-visible');
  }

  async function apiFetch(url, options = {}) {
    const fetchOptions = {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    };

    const token = localStorage.getItem('token');
    if (token && !fetchOptions.headers.Authorization) {
      fetchOptions.headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, fetchOptions);
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : {};

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  }

  function formatRate(facility) {
    if (facility.category === 'COTTAGE') return rateRange(facility.price_min, facility.price_max);
    if (facility.category === 'CABANA') return `${rateRange(facility.day_rate_min, facility.day_rate_max)} / day`;
    return `${peso(facility.hourly_rate)} / hr<br><span class="admin-rate-meta">${peso(facility.daily_rate)} / day</span>`;
  }

  function formatCapacity(facility) {
    if (facility.category === 'CABANA') return `${facility.capacity_min || 0}-${facility.capacity_max || 0} pax`;
    return facility.category === 'BEACH_EQUIPMENT' ? 'Rental item' : 'Day use';
  }

  function rateRange(min, max) {
    if (min === null || min === undefined || min === '') return '<span class="text-muted-small">No price</span>';
    return Number(max) > Number(min) ? `${peso(min)} - ${peso(max)}` : peso(min);
  }

  function peso(value) {
    return `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
  }

  function categoryLabel(category) {
    return {
      COTTAGE: 'Cottages',
      CABANA: 'Rooms / Cabanas',
      BEACH_EQUIPMENT: 'Beach Equipment',
    }[category] || escHtml(category || '');
  }

  function categoryImage(category) {
    if (category === 'CABANA') return '/assets/images/cabana.jpg';
    if (category === 'BEACH_EQUIPMENT') return '/assets/images/beach_equipment.jpg';
    return '/assets/images/cottage.jpg';
  }

  function sizeLabel(size) {
    return {
      SMALL: 'Small',
      MEDIUM: 'Medium',
      LARGE: 'Large',
      EXTRA_LARGE: 'Extra Large',
    }[size] || '<span class="text-muted-small">N/A</span>';
  }

  function statusBadge(enabled, yes, no) {
    return `<span class="badge ${enabled ? 'status-approved' : 'status-cancelled'}">${enabled ? yes : no}</span>`;
  }

  function showAlert(message, type) {
    els.facilityAlert.textContent = message;
    els.facilityAlert.className = `facility-alert facility-alert-${type} show`;
    window.clearTimeout(showAlert.timer);
    showAlert.timer = window.setTimeout(() => {
      els.facilityAlert.classList.remove('show');
    }, 4500);
  }

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escAttr(str) {
    return escHtml(str).replace(/`/g, '&#96;');
  }
})();
