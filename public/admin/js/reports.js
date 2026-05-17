/**
 * Admin reports: filtered booking summaries, charts, and CSV export.
 */
(function () {
  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const charts = new Map();
  let currentRows = [];
  let currentFilters = null;
  let currentSummary = null;

  const palette = {
    primary: '#0d9488',
    teal: '#14b8a6',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#2563eb',
    slate: '#64748b',
  };

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(value) {
    return `PHP ${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function monthBounds() {
    const now = new Date();
    return {
      start: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showAlert(message, type = 'error') {
    const el = document.getElementById('reportsAlert');
    if (!el) return;
    el.className = `dashboard-alert ${type === 'success' ? 'dashboard-alert-success' : ''}`;
    el.textContent = message;
  }

  function hideAlert() {
    const el = document.getElementById('reportsAlert');
    if (!el) return;
    el.className = 'dashboard-alert is-hidden';
    el.textContent = '';
  }

  function statusBadge(value) {
    const status = String(value || 'pending').toLowerCase();
    if (status === 'approved') return '<span class="status-badge status-approved">Approved</span>';
    if (status === 'cancelled') return '<span class="status-badge status-cancelled">Cancelled</span>';
    return '<span class="status-badge status-pending">Pending</span>';
  }

  function paymentBadge(value) {
    const status = String(value || 'pending').toLowerCase();
    if (status === 'paid') return '<span class="status-badge status-paid">Paid</span>';
    if (status === 'failed') return '<span class="status-badge status-rejected">Failed</span>';
    if (status === 'refunded') return '<span class="status-badge status-cancelled">Refunded</span>';
    return '<span class="status-badge status-pending">Pending</span>';
  }

  function showChartMessage(canvas, message) {
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas || !wrap) return;
    canvas.style.visibility = 'hidden';
    let el = wrap.querySelector('.chart-empty-msg');
    if (!el) {
      el = document.createElement('p');
      el.className = 'chart-empty-msg';
      wrap.appendChild(el);
    }
    el.textContent = message;
  }

  function clearChartMessage(canvas) {
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas || !wrap) return;
    canvas.style.visibility = 'visible';
    wrap.querySelector('.chart-empty-msg')?.remove();
  }

  function hasValues(data) {
    return (data?.labels || []).length > 0 && (data?.values || []).some((value) => Number(value || 0) > 0);
  }

  function renderChart(canvasId, type, labels, values, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!labels.length || !values.some((value) => Number(value || 0) > 0)) {
      charts.get(canvasId)?.destroy();
      charts.delete(canvasId);
      showChartMessage(canvas, options.emptyMessage || 'No report data yet.');
      return;
    }

    clearChartMessage(canvas);
    if (!window.Chart) {
      showChartMessage(canvas, 'Charts are unavailable. Use the table or CSV export.');
      return;
    }

    charts.get(canvasId)?.destroy();
    charts.set(canvasId, new Chart(canvas, {
      type,
      data: {
        labels,
        datasets: [{
          label: options.label || 'Value',
          data: values,
          borderColor: options.borderColor || palette.primary,
          backgroundColor: options.backgroundColor || palette.primary,
          pointBackgroundColor: options.borderColor || palette.primary,
          pointBorderColor: '#ffffff',
          borderWidth: 2,
          tension: 0.28,
          fill: false,
        }],
      },
      options: options.chartOptions || {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: type !== 'line' && type !== 'bar' } },
        scales: type === 'doughnut' || type === 'pie' ? undefined : {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
      },
    }));
  }

  async function api(url) {
    const res = await fetch(url, {
      headers: authHeader,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to load reports.');
    return data;
  }

  function getFilterParams() {
    const params = new URLSearchParams();
    const values = {
      startDate: document.getElementById('startDate')?.value,
      endDate: document.getElementById('endDate')?.value,
      category: document.getElementById('categoryFilter')?.value,
      bookingStatus: document.getElementById('bookingStatusFilter')?.value,
      paymentStatus: document.getElementById('paymentStatusFilter')?.value,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params;
  }

  function renderSummary(summary, filters, rows) {
    setText('reportRevenue', money(summary.totalRevenue));
    setText('reportAverage', `Average paid booking ${money(summary.averagePaidBooking)}`);
    setText('reportBookings', Number(summary.totalBookings || 0).toLocaleString());
    setText(
      'reportBookingMix',
      `${Number(summary.approvedBookings || 0).toLocaleString()} approved, ${Number(summary.pendingBookings || 0).toLocaleString()} pending`
    );
    setText('reportPaid', Number(summary.paidBookings || 0).toLocaleString());
    setText(
      'reportPaymentMix',
      `${Number(summary.pendingPayments || 0).toLocaleString()} pending, ${Number(summary.failedPayments || 0).toLocaleString()} failed`
    );
    setText('reportGuests', Number(summary.totalGuests || 0).toLocaleString());
    setText('reportCheckins', `${Number(summary.checkedInCount || 0).toLocaleString()} checked in`);
    setText('reportRangeLabel', `${filters.startDate} to ${filters.endDate}`);
    setText('reportRowsCount', rows.length.toLocaleString());
    setText('reportCancelled', Number(summary.cancelledBookings || 0).toLocaleString());
  }

  function renderTable(rows) {
    const tbody = document.getElementById('reportsTbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state">
            <p>No report rows found for the selected filters.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row) => {
      const reference = row.reference_number || row.gcash_ref_no || row.provider_payment_id || '-';
      return `
        <tr>
          <td>#${esc(row.id)}</td>
          <td>${esc(row.date)}</td>
          <td>
            <div class="text-strong">${esc(row.facility_name)}</div>
            <div class="text-muted small-muted">${esc(String(row.facility_category || '').replace(/_/g, ' '))}</div>
          </td>
          <td>
            <div class="text-strong">${esc(row.user_name)}</div>
            <div class="text-muted small-muted">${esc(row.user_email)}</div>
          </td>
          <td>${Number(row.quantity || 0).toLocaleString()} / ${Number(row.guest_count || 0).toLocaleString()} pax</td>
          <td>${money(row.total_amount)}</td>
          <td>${statusBadge(row.status)}</td>
          <td>${paymentBadge(row.payment_status)}</td>
          <td>${esc(reference)}</td>
        </tr>`;
    }).join('');
  }

  function renderCharts(chartsData) {
    renderChart(
      'reportRevenueChart',
      'line',
      chartsData.dailyRevenue?.labels || [],
      chartsData.dailyRevenue?.values || [],
      {
        label: 'Paid revenue',
        borderColor: palette.primary,
        emptyMessage: 'No paid revenue for this filter.',
      }
    );

    renderChart(
      'reportPaymentChart',
      'doughnut',
      chartsData.paymentStatus?.labels || [],
      chartsData.paymentStatus?.values || [],
      {
        backgroundColor: [palette.green, palette.amber, palette.red, palette.blue],
        emptyMessage: 'No payment status data for this filter.',
        chartOptions: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } } },
        },
      }
    );

    renderChart(
      'reportCategoryChart',
      'bar',
      chartsData.categoryRevenue?.labels || [],
      chartsData.categoryRevenue?.values || [],
      {
        label: 'Paid revenue',
        backgroundColor: palette.teal,
        emptyMessage: 'No category revenue for this filter.',
      }
    );
  }

  async function loadReports() {
    hideAlert();
    const params = getFilterParams();
    const data = await api(`/api/admin/reports?${params.toString()}`);
    currentRows = Array.isArray(data.rows) ? data.rows : [];
    currentFilters = data.filters || {};
    currentSummary = data.summary || {};
    renderSummary(currentSummary, currentFilters, currentRows);
    renderCharts(data.charts || {});
    renderTable(currentRows);
    if (window.lucide) lucide.createIcons();
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function xmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function wordText(value, options = {}) {
    const safe = xmlEscape(value);
    const bold = options.bold ? '<w:b/>' : '';
    const size = options.size ? `<w:sz w:val="${options.size}"/>` : '';
    const color = options.color ? `<w:color w:val="${options.color}"/>` : '';
    const runProps = bold || size || color ? `<w:rPr>${bold}${size}${color}</w:rPr>` : '';
    return `<w:r>${runProps}<w:t xml:space="preserve">${safe}</w:t></w:r>`;
  }

  function wordParagraph(value, options = {}) {
    const align = options.align ? `<w:jc w:val="${options.align}"/>` : '';
    const spacing = '<w:spacing w:after="160"/>';
    const props = align || spacing ? `<w:pPr>${spacing}${align}</w:pPr>` : '';
    return `<w:p>${props}${wordText(value, options)}</w:p>`;
  }

  function wordCell(value, options = {}) {
    const fill = options.fill ? `<w:shd w:fill="${options.fill}"/>` : '';
    const width = options.width ? `<w:tcW w:w="${options.width}" w:type="dxa"/>` : '';
    const props = fill || width ? `<w:tcPr>${width}${fill}</w:tcPr>` : '';
    return `<w:tc>${props}${wordParagraph(value, options)}</w:tc>`;
  }

  function wordTable(rows, headers = []) {
    const headerRow = headers.length
      ? `<w:tr>${headers.map((header) => wordCell(header, { bold: true, fill: 'E2E8F0' })).join('')}</w:tr>`
      : '';
    const bodyRows = rows.map((row) => (
      `<w:tr>${row.map((value) => wordCell(value)).join('')}</w:tr>`
    )).join('');
    return `
      <w:tbl>
        <w:tblPr>
          <w:tblStyle w:val="TableGrid"/>
          <w:tblW w:w="0" w:type="auto"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          </w:tblBorders>
        </w:tblPr>
        ${headerRow}
        ${bodyRows}
      </w:tbl>`;
  }

  function buildDocumentXml() {
    const summary = currentSummary || {};
    const filters = currentFilters || {};
    const generatedAt = new Date().toLocaleString();
    const range = `${filters.startDate || '-'} to ${filters.endDate || '-'}`;
    const filterRows = [
      ['Generated', generatedAt],
      ['Date range', range],
      ['Facility category', filters.category ? String(filters.category).replace(/_/g, ' ') : 'All categories'],
      ['Booking status', filters.bookingStatus || 'All booking statuses'],
      ['Payment status', filters.paymentStatus || 'All payment statuses'],
    ];
    const summaryRows = [
      ['Paid revenue', money(summary.totalRevenue)],
      ['Average paid booking', money(summary.averagePaidBooking)],
      ['Total bookings', Number(summary.totalBookings || 0).toLocaleString()],
      ['Approved bookings', Number(summary.approvedBookings || 0).toLocaleString()],
      ['Pending bookings', Number(summary.pendingBookings || 0).toLocaleString()],
      ['Cancelled bookings', Number(summary.cancelledBookings || 0).toLocaleString()],
      ['Paid bookings', Number(summary.paidBookings || 0).toLocaleString()],
      ['Pending payments', Number(summary.pendingPayments || 0).toLocaleString()],
      ['Failed payments', Number(summary.failedPayments || 0).toLocaleString()],
      ['Total guests', Number(summary.totalGuests || 0).toLocaleString()],
      ['Checked in', Number(summary.checkedInCount || 0).toLocaleString()],
    ];
    const bookingRows = currentRows.map((row) => [
      `#${row.id}`,
      row.date,
      row.facility_name,
      String(row.facility_category || '').replace(/_/g, ' '),
      row.user_name,
      row.user_email,
      `${Number(row.quantity || 0).toLocaleString()} / ${Number(row.guest_count || 0).toLocaleString()} pax`,
      money(row.total_amount),
      row.status,
      row.payment_status,
      row.reference_number || row.gcash_ref_no || row.provider_payment_id || '',
    ]);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          ${wordParagraph('Mamagan Beach Resort', { bold: true, size: 32, color: '0F172A', align: 'center' })}
          ${wordParagraph('Booking and Revenue Report', { bold: true, size: 28, color: '0D9488', align: 'center' })}
          ${wordParagraph('Report Filters', { bold: true, size: 24, color: '0F172A' })}
          ${wordTable(filterRows, ['Field', 'Value'])}
          ${wordParagraph('Summary', { bold: true, size: 24, color: '0F172A' })}
          ${wordTable(summaryRows, ['Metric', 'Value'])}
          ${wordParagraph('Booking Details', { bold: true, size: 24, color: '0F172A' })}
          ${bookingRows.length ? wordTable(bookingRows, [
            'Booking', 'Date', 'Facility', 'Category', 'Guest', 'Email',
            'Qty / Pax', 'Amount', 'Booking Status', 'Payment Status', 'Reference',
          ]) : wordParagraph('No booking rows found for the selected filters.')}
          <w:sectPr>
            <w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>
            <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/>
          </w:sectPr>
        </w:body>
      </w:document>`;
  }

  function crc32(bytes) {
    const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      return value >>> 0;
    }));
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function uint16(value) {
    return [value & 0xff, (value >>> 8) & 0xff];
  }

  function uint32(value) {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
  }

  function dosTimeParts(date = new Date()) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = Math.max(1, date.getDate());
    const month = date.getMonth() + 1;
    const year = Math.max(0, date.getFullYear() - 1980);
    return { time, date: (year << 9) | (month << 5) | day };
  }

  function concatBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const stamp = dosTimeParts();

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = encoder.encode(file.content);
      const crc = crc32(dataBytes);
      const localHeader = new Uint8Array([
        ...uint32(0x04034b50),
        ...uint16(20),
        ...uint16(0x0800),
        ...uint16(0),
        ...uint16(stamp.time),
        ...uint16(stamp.date),
        ...uint32(crc),
        ...uint32(dataBytes.length),
        ...uint32(dataBytes.length),
        ...uint16(nameBytes.length),
        ...uint16(0),
      ]);
      localParts.push(localHeader, nameBytes, dataBytes);

      const centralHeader = new Uint8Array([
        ...uint32(0x02014b50),
        ...uint16(20),
        ...uint16(20),
        ...uint16(0x0800),
        ...uint16(0),
        ...uint16(stamp.time),
        ...uint16(stamp.date),
        ...uint32(crc),
        ...uint32(dataBytes.length),
        ...uint32(dataBytes.length),
        ...uint16(nameBytes.length),
        ...uint16(0),
        ...uint16(0),
        ...uint16(0),
        ...uint16(0),
        ...uint32(0),
        ...uint32(offset),
      ]);
      centralParts.push(centralHeader, nameBytes);
      offset += localHeader.length + nameBytes.length + dataBytes.length;
    });

    const central = concatBytes(centralParts);
    const endRecord = new Uint8Array([
      ...uint32(0x06054b50),
      ...uint16(0),
      ...uint16(0),
      ...uint16(files.length),
      ...uint16(files.length),
      ...uint32(central.length),
      ...uint32(offset),
      ...uint16(0),
    ]);

    return concatBytes([...localParts, central, endRecord]);
  }

  function buildDocxBlob() {
    const files = [
      {
        name: '[Content_Types].xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          </Types>`,
      },
      {
        name: '_rels/.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
          </Relationships>`,
      },
      {
        name: 'word/document.xml',
        content: buildDocumentXml(),
      },
    ];
    return new Blob([createZip(files)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  function exportCsv() {
    if (!currentRows.length) {
      showAlert('There are no rows to export for the selected filters.');
      return;
    }

    const headers = [
      'Booking ID',
      'Date',
      'Facility',
      'Category',
      'Guest Name',
      'Guest Email',
      'Quantity',
      'Guest Count',
      'Total Amount',
      'Booking Status',
      'Payment Status',
      'Reference',
    ];
    const lines = [headers.map(csvCell).join(',')];
    currentRows.forEach((row) => {
      lines.push([
        row.id,
        row.date,
        row.facility_name,
        row.facility_category,
        row.user_name,
        row.user_email,
        row.quantity,
        row.guest_count,
        row.total_amount,
        row.status,
        row.payment_status,
        row.reference_number || row.gcash_ref_no || row.provider_payment_id || '',
      ].map(csvCell).join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const start = currentFilters?.startDate || 'report';
    const end = currentFilters?.endDate || localDateKey();
    link.href = url;
    link.download = `mamagan-report-${start}-to-${end}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showAlert('CSV report exported.', 'success');
  }

  function exportDocx() {
    if (!currentSummary) {
      showAlert('Load the report before exporting to DOCX.');
      return;
    }

    const blob = buildDocxBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const start = currentFilters?.startDate || 'report';
    const end = currentFilters?.endDate || localDateKey();
    link.href = url;
    link.download = `mamagan-report-${start}-to-${end}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showAlert('DOCX report exported.', 'success');
  }

  function resetFilters() {
    const bounds = monthBounds();
    document.getElementById('startDate').value = bounds.start;
    document.getElementById('endDate').value = bounds.end;
    document.getElementById('categoryFilter').value = '';
    document.getElementById('bookingStatusFilter').value = '';
    document.getElementById('paymentStatusFilter').value = '';
    loadReports().catch((err) => showAlert(err.message));
  }

  function initDefaults() {
    const bounds = monthBounds();
    const start = document.getElementById('startDate');
    const end = document.getElementById('endDate');
    if (start && !start.value) start.value = bounds.start;
    if (end && !end.value) end.value = bounds.end;
  }

  document.getElementById('reportsFilters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadReports().catch((err) => showAlert(err.message));
  });
  document.getElementById('resetReportsBtn')?.addEventListener('click', resetFilters);
  document.getElementById('exportReportsBtn')?.addEventListener('click', exportCsv);
  document.getElementById('exportDocxBtn')?.addEventListener('click', exportDocx);
  document.getElementById('printReportsBtn')?.addEventListener('click', () => window.print());

  initDefaults();
  loadReports().catch((err) => showAlert(err.message));
})();
