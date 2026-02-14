const loadingEl = document.querySelector('.loading');
const tableEl = document.querySelector('.table');

function showLoading() {
    loadingEl?.classList.remove('hidden');
    tableEl?.classList.add('hidden');
}

function showTable() {
    loadingEl?.classList.add('hidden');
    tableEl?.classList.remove('hidden');
}

async function loadHighlights() {
    showLoading();
    const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

    try {
        const response = await fetch(baseUrl + '/api/highlights');

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        populateData(data);
    } catch (error) {
        console.error('Failed to fetch highlights:', error);
        if (tableEl) {
            tableEl.innerHTML = '<p>Failed to load highlights.</p>';
        }
    } finally {
        showTable();
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function translateHighlight(type) {
    switch (type) {
        case '180':
            return '180s';
        case 'HIGH_FINISH':
            return 'High Finish';
        case 'SHORT_LEG':
            return 'Short Legs';
        case 'D1_FINISH':
            return 'Mad House';
        case 'BULL_FINISH':
            return 'Bull Finishes';
        default:
            return type;
    }
}

function getHighlightTypes(highlightsByPlayer) {
    const set = new Set();

    for (const playerHighlights of Object.values(highlightsByPlayer)) {
        if (!playerHighlights || typeof playerHighlights !== 'object') {
            continue;
        }

        for (const type of Object.keys(playerHighlights)) {
            set.add(type);
        }
    }

    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normalizeEntry(entry) {
    if (typeof entry === 'string') {
        return { date: entry, value: '\u2014', comment: '' };
    }

    if (!entry || typeof entry !== 'object') {
        return { date: '', value: '\u2014', comment: '' };
    }

    return {
        date: entry.date ?? '',
        value: entry.value ?? '\u2014',
        comment: entry.comment ?? '',
    };
}

function buildDetailSection(type, entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return '';
    }

    const rows = entries
        .map((entry, index) => {
            const normalized = normalizeEntry(entry);
            return `
        <tr>
          <td>${escapeHtml(normalized.date || '\u2014')}</td>
          <td>${escapeHtml(normalized.value)}</td>
          <td>${escapeHtml(normalized.comment || '\u2014')}</td>
        </tr>
      `;
        })
        .join('');

    return `
    <article class="detail-card">
      <h3>${escapeHtml(translateHighlight(type))}</h3>
      <table class="detail-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Score</th>
            <th>Notiz</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </article>
  `;
}

function buildPlayerCards(highlightsByPlayer, types) {
    return Object.entries(highlightsByPlayer)
        .map(([playerName, playerHighlights], playerIndex) => {
            const summaryItems = types
                .map((type) => {
                    const entries = Array.isArray(playerHighlights?.[type]) ? playerHighlights[type] : [];
                    if (entries.length === 0) return ''
                    return `
            <div class="summary-item">
            <span class="summary-label">${escapeHtml(translateHighlight(type))}</span>
            <span class="summary-count">${entries.length}</span>
            </div>
          `;
                })
                .join('');

            const detailSections = types
                .map((type) => buildDetailSection(type, playerHighlights?.[type]))
                .filter(Boolean)
                .join('');

            const detailContent = detailSections || '<p>No highlight entries available.</p>';
            const detailId = `player-details-${playerIndex}`;

            return `
        <article class="player-card" tabindex="0" role="button" aria-expanded="false" aria-controls="${detailId}">
          <div class="player-card-head">
            <h2>${escapeHtml(playerName)}</h2>
            <span class="expand-icon" aria-hidden="true">+</span>
          </div>
          <div class="summary-grid">
            ${summaryItems}
          </div>
          <div id="${detailId}" class="detail-panel hidden">
            <div class="detail-grid">
              ${detailContent}
            </div>
          </div>
        </article>
      `;
        })
        .join('');
}

function togglePlayerCard(playerCard) {
    const detailPanel = playerCard.querySelector('.detail-panel');
    if (!detailPanel) {
        return;
    }

    const isExpanded = playerCard.getAttribute('aria-expanded') === 'true';
    playerCard.setAttribute('aria-expanded', String(!isExpanded));
    playerCard.classList.toggle('is-expanded', !isExpanded);
    detailPanel.classList.toggle('hidden', isExpanded);
}

function bindCardToggles() {
    if (!tableEl) {
        return;
    }

    const cards = tableEl.querySelectorAll('.player-card');
    for (const card of cards) {
        card.addEventListener('click', () => togglePlayerCard(card));
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            event.preventDefault();
            togglePlayerCard(card);
        });
    }
}

function populateData(data) {
    if (!tableEl) {
        return;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        tableEl.innerHTML = '<p>No highlights found.</p>';
        return;
    }

    const types = getHighlightTypes(data);
    if (types.length === 0) {
        tableEl.innerHTML = '<p>No highlights found.</p>';
        return;
    }

    const cards = buildPlayerCards(data, types);

    tableEl.innerHTML = `
    <section class="player-cards" aria-label="Players and highlight summaries">
      ${cards}
    </section>
  `;

    bindCardToggles();
}

document.addEventListener('DOMContentLoaded', loadHighlights);
