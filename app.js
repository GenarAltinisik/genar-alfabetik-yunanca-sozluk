// ==================== YUNANCA ALFABE VE SIRALAMA YARDIMCILARI ====================
const GREEK_ALPHABET = [
  'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ',
  'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π',
  'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'
];

// Polifonik aksanları ve nefes işaretlerini temizleyip saf alfabetik sıraya sokan yardımcı
function stripGreekDiacritics(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ')
    .toLowerCase()
    .trim();
}

function getInitialGreekLetter(word) {
  const clean = stripGreekDiacritics(word).toUpperCase();
  for (const ch of clean) {
    if (GREEK_ALPHABET.includes(ch)) return ch;
  }
  return 'Α';
}

// ==================== UYGULAMA DURUMU (STATE) ====================
const STORAGE_KEYS = {
  STATUS: 'genar_greek_word_status_v1',   // { [wordId]: 'memorized' | 'hard' }
  NOTES: 'genar_greek_word_notes_v1',     // { [wordId]: string }
  LAST_STATE: 'genar_greek_last_state_v1', // { pool, indexByPool, theme }
};

let state = {
  pool: 'all',          // 'course' | 'all'
  mode: 'hafiz',        // 'hafiz' | 'dict'
  currentIndex: 0,
  indexByPool: { all: 0, course: 0 },
  hideMeanings: false,
  blurNext: false,
  peeking: false,
  dictSearch: '',
  dictLetter: 'ALL',
  dictStatusFilter: 'all',
  wordStatus: {},
  wordNotes: {},
  theme: 'dark'
};

// Aktif havuza göre alfabetik sıralanmış kelime listesi
let activeWords = [];
let allSortedWords = [];
let courseSortedWords = [];

function loadLocalData() {
  try {
    const savedStatus = localStorage.getItem(STORAGE_KEYS.STATUS);
    if (savedStatus) state.wordStatus = JSON.parse(savedStatus);

    const savedNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (savedNotes) state.wordNotes = JSON.parse(savedNotes);

    const savedLast = localStorage.getItem(STORAGE_KEYS.LAST_STATE);
    if (savedLast) {
      const parsed = JSON.parse(savedLast);
      if (parsed.pool) state.pool = parsed.pool;
      if (parsed.indexByPool) state.indexByPool = parsed.indexByPool;
      if (parsed.theme) state.theme = parsed.theme;
    }
  } catch (e) {
    console.warn('LocalStorage okunamadı:', e);
  }
}

function saveLocalState() {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_STATE, JSON.stringify({
      pool: state.pool,
      indexByPool: state.indexByPool,
      theme: state.theme
    }));
  } catch (e) {}
}

function prepareWordPools() {
  const rawList = Array.isArray(window.GREEK_WORDS) ? window.GREEK_WORDS : [];
  // Her kelimeyi saf Yunanca alfabetik sıraya göre diz
  allSortedWords = [...rawList].sort((a, b) => {
    const ca = stripGreekDiacritics(a.greek);
    const cb = stripGreekDiacritics(b.greek);
    return ca.localeCompare(cb, 'el');
  });

  courseSortedWords = allSortedWords.filter(w => w.isCourse === true);
  updatePoolSelection(state.pool, false);
}

function updatePoolSelection(poolName, resetIndex = false) {
  state.pool = poolName;
  activeWords = poolName === 'course' ? courseSortedWords : allSortedWords;

  if (resetIndex) {
    state.currentIndex = state.indexByPool[poolName] || 0;
  } else {
    state.currentIndex = state.indexByPool[poolName] || 0;
  }

  if (state.currentIndex >= activeWords.length) {
    state.currentIndex = Math.max(0, activeWords.length - 1);
  }

  // Buton görünümlerini güncelle
  document.getElementById('poolCourseBtn').classList.toggle('active', poolName === 'course');
  document.getElementById('poolAllBtn').classList.toggle('active', poolName === 'all');
  document.getElementById('courseCountBadge').textContent = courseSortedWords.length;
  document.getElementById('allCountBadge').textContent = allSortedWords.length;

  renderAlphabetBar();
  renderCurrentView();
  updateGlobalProgress();
  saveLocalState();
}

// ==================== ALFABE ŞERİDİ ====================
function renderAlphabetBar() {
  const bar = document.getElementById('alphabetBar');
  bar.innerHTML = '';

  const availableLetters = new Set(activeWords.map(w => getInitialGreekLetter(w.greek)));
  const currentWord = activeWords[state.currentIndex];
  const currentLetter = currentWord ? getInitialGreekLetter(currentWord.greek) : null;

  if (state.mode === 'dict') {
    const allBtn = document.createElement('button');
    allBtn.className = 'alpha-btn' + (state.dictLetter === 'ALL' ? ' active' : '');
    allBtn.textContent = 'Tümü';
    allBtn.addEventListener('click', () => {
      state.dictLetter = 'ALL';
      renderAlphabetBar();
      renderDictionary();
    });
    bar.appendChild(allBtn);
  }

  GREEK_ALPHABET.forEach(letter => {
    const btn = document.createElement('button');
    const hasWords = availableLetters.has(letter);
    btn.className = 'alpha-btn';
    btn.textContent = letter;
    btn.disabled = !hasWords;

    if (state.mode === 'hafiz' && currentLetter === letter) {
      btn.classList.add('active');
    } else if (state.mode === 'dict' && state.dictLetter === letter) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      if (state.mode === 'hafiz') {
        const firstIdx = activeWords.findIndex(w => getInitialGreekLetter(w.greek) === letter);
        if (firstIdx !== -1) setCurrentIndex(firstIdx);
      } else {
        state.dictLetter = state.dictLetter === letter ? 'ALL' : letter;
        renderAlphabetBar();
        renderDictionary();
      }
    });

    bar.appendChild(btn);
  });
}

// ==================== HAFIZ MODU: 3D DAİRESEL ÇARK ====================
function setCurrentIndex(newIdx) {
  if (activeWords.length === 0) return;
  const clamped = Math.max(0, Math.min(activeWords.length - 1, newIdx));
  state.currentIndex = clamped;
  state.indexByPool[state.pool] = clamped;
  saveLocalState();

  renderWheel();
  renderDetail();
  renderAlphabetBar();
}

function renderWheel() {
  const drum = document.getElementById('wheelDrum');
  const posBadge = document.getElementById('wheelPositionBadge');
  const jumpInput = document.getElementById('jumpInput');

  drum.classList.toggle('hide-meanings', state.hideMeanings);
  drum.classList.toggle('blur-next', state.blurNext);
  drum.classList.toggle('peeking', state.peeking);

  if (activeWords.length === 0) {
    drum.innerHTML = `<div style="text-align:center; padding-top:200px; color:var(--text-secondary);">Bu havuzda henüz kelime yok.</div>`;
    posBadge.textContent = '0 / 0';
    return;
  }

  posBadge.textContent = `Sıra #${state.currentIndex + 1} / ${activeWords.length}`;
  jumpInput.max = activeWords.length;
  jumpInput.value = state.currentIndex + 1;

  drum.innerHTML = '';

  // iOS Saat Çarkı: Ortadaki kelimenin üstünde 4 (-4..-1) ve altında 4 (+1..+4) kelime göster
  const VISIBLE_RANGE = 4;
  for (let offset = -VISIBLE_RANGE; offset <= VISIBLE_RANGE; offset++) {
    const idx = state.currentIndex + offset;
    if (idx < 0 || idx >= activeWords.length) continue;

    const word = activeWords[idx];
    const item = document.createElement('div');
    item.className = 'wheel-item';
    if (offset === 0) item.classList.add('is-center');
    if (offset > 0) item.classList.add('is-after');
    if (offset < 0) item.classList.add('is-before');

    // 3D Silindirik Geometri Hesabı (iOS Picker eğimi)
    const angleDeg = offset * 19.5;
    const angleRad = (angleDeg * Math.PI) / 180;
    const radiusY = 205;
    const translateY = Math.sin(angleRad) * radiusY;
    const translateZ = (Math.cos(angleRad) - 1) * 145;
    const rotateX = -angleDeg;
    const scale = offset === 0 ? 1.02 : Math.max(0.76, 1 - Math.abs(offset) * 0.065);
    const opacity = offset === 0 ? 1 : Math.max(0.18, 1 - Math.abs(offset) * 0.21);

    item.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, ${translateZ.toFixed(1)}px) rotateX(${rotateX.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
    item.style.opacity = opacity.toFixed(2);

    const status = state.wordStatus[word.id];
    let statusHtml = '';
    if (status === 'memorized') statusHtml = '<span title="Ezberlendi" style="color:var(--accent-emerald)">✓</span>';
    else if (status === 'hard') statusHtml = '<span title="Zorlanıyorum" style="color:var(--accent-crimson)">!</span>';
    else if (word.isCourse) statusHtml = '<span title="Ders Kelimesi" style="color:var(--gold-primary)">•</span>';

    item.innerHTML = `
      <span class="wheel-item-index">#${idx + 1}</span>
      <span class="wheel-item-greek" lang="el">${word.greek}</span>
      <span class="wheel-item-meaning">${word.shortMeaning}</span>
      <span class="wheel-item-status">${statusHtml}</span>
    `;

    item.addEventListener('click', () => {
      if (offset === 0) {
        // Ortadaki kelimeye tıklanırsa gizli anlamı anlık aç/kapat
        if (state.hideMeanings || state.blurNext) {
          state.peeking = !state.peeking;
          drum.classList.toggle('peeking', state.peeking);
        }
      } else {
        setCurrentIndex(idx);
      }
    });

    drum.appendChild(item);
  }
}

// ==================== BÜYÜK DETAY KUTUCUĞU ====================
function renderDetail() {
  if (activeWords.length === 0) return;
  const word = activeWords[state.currentIndex];
  const idx = state.currentIndex;

  document.getElementById('detailRankBadge').textContent = `Sıra #${idx + 1}`;
  document.getElementById('detailLetterBadge').textContent = getInitialGreekLetter(word.greek);
  document.getElementById('detailPosBadge').textContent = word.pos || 'Kelime';

  const courseBadge = document.getElementById('detailCourseBadge');
  courseBadge.classList.toggle('hidden', !word.isCourse);

  document.getElementById('detailGreekWord').textContent = word.greek;
  document.getElementById('detailFullForm').textContent = word.fullForm || word.greek;
  document.getElementById('detailPronunciation').textContent = `/${word.pronunciation || stripGreekDiacritics(word.greek)}/`;
  document.getElementById('detailShortMeaning').textContent = word.shortMeaning;

  // Ezber durumu butonları
  const currentStatus = state.wordStatus[word.id] || null;
  const memBtn = document.getElementById('markMemorizedBtn');
  const hardBtn = document.getElementById('markHardBtn');
  memBtn.classList.toggle('active-memorized', currentStatus === 'memorized');
  document.getElementById('memorizedBtnText').textContent = currentStatus === 'memorized' ? 'Ezberlendi' : 'Ezberledim';
  hardBtn.classList.toggle('active-hard', currentStatus === 'hard');

  // 1. Detaylı Anlamlar
  const meaningsEl = document.getElementById('detailFullMeanings');
  if (Array.isArray(word.detailedMeanings) && word.detailedMeanings.length > 0) {
    meaningsEl.innerHTML = `<ul class="meaning-list">${word.detailedMeanings.map(m => `<li>${m}</li>`).join('')}</ul>`;
  } else {
    meaningsEl.innerHTML = `<p>${word.shortMeaning}</p>`;
  }

  // 2. Etimoloji ve Çağrışım
  const etymEl = document.getElementById('detailEtymology');
  etymEl.innerHTML = `<p>${word.etymology || 'Bu kelime için çağrışım notunuzu aşağıya ekleyebilirsiniz.'}</p>`;

  // 3. Komşu Kelimeler (Alfabetik Zincir Bağlantısı)
  const prevWord = idx > 0 ? activeWords[idx - 1] : null;
  const nextWord = idx < activeWords.length - 1 ? activeWords[idx + 1] : null;

  const prevCard = document.getElementById('neighborPrevCard');
  const nextCard = document.getElementById('neighborNextCard');

  document.getElementById('neighborCurrentGreek').textContent = word.greek;

  if (prevWord) {
    prevCard.disabled = false;
    document.getElementById('neighborPrevGreek').textContent = `#${idx} ${prevWord.greek}`;
    document.getElementById('neighborPrevMeaning').textContent = prevWord.shortMeaning;
  } else {
    prevCard.disabled = true;
    document.getElementById('neighborPrevGreek').textContent = '—';
    document.getElementById('neighborPrevMeaning').textContent = 'Sözlük Başı';
  }

  if (nextWord) {
    nextCard.disabled = false;
    document.getElementById('neighborNextGreek').textContent = `#${idx + 2} ${nextWord.greek}`;
    document.getElementById('neighborNextMeaning').textContent = nextWord.shortMeaning;
  } else {
    nextCard.disabled = true;
    document.getElementById('neighborNextGreek').textContent = '—';
    document.getElementById('neighborNextMeaning').textContent = 'Sözlük Sonu';
  }

  // 4. Kişisel Not
  const noteInput = document.getElementById('personalNoteInput');
  noteInput.value = state.wordNotes[word.id] || '';
}

// ==================== NORMAL SÖZLÜK MODU ====================
function renderDictionary() {
  const listEl = document.getElementById('dictList');
  const countEl = document.getElementById('dictResultCount');
  const q = state.dictSearch.trim().toLowerCase();
  const qCleanGreek = stripGreekDiacritics(q);

  const filtered = activeWords
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => {
      if (state.dictLetter !== 'ALL' && getInitialGreekLetter(word.greek) !== state.dictLetter) {
        return false;
      }

      const st = state.wordStatus[word.id];
      if (state.dictStatusFilter === 'memorized' && st !== 'memorized') return false;
      if (state.dictStatusFilter === 'unmemorized' && st === 'memorized') return false;
      if (state.dictStatusFilter === 'hard' && st !== 'hard') return false;

      if (!q) return true;

      const greekNorm = stripGreekDiacritics(word.greek);
      const latinNorm = (word.latin || word.pronunciation || '').toLowerCase();
      const shortNorm = (word.shortMeaning || '').toLowerCase();
      const detailNorm = (word.detailedMeanings || []).join(' ').toLowerCase();
      const etymNorm = (word.etymology || '').toLowerCase();

      return (
        word.greek.toLowerCase().includes(q) ||
        greekNorm.includes(qCleanGreek) ||
        latinNorm.includes(q) ||
        shortNorm.includes(q) ||
        detailNorm.includes(q) ||
        etymNorm.includes(q)
      );
    });

  countEl.textContent = `${filtered.length} kelime listeleniyor (${state.pool === 'course' ? 'Ders/Sınav Havuzu' : 'Genel Sözlük'})`;
  listEl.innerHTML = '';

  filtered.forEach(({ word, index }) => {
    const card = document.createElement('div');
    card.className = 'dict-item-card';
    const st = state.wordStatus[word.id];

    let badgeHtml = '';
    if (st === 'memorized') badgeHtml = '<span class="pos-badge" style="background:var(--accent-emerald-bg);color:var(--accent-emerald)">✓ Ezberlendi</span>';
    else if (st === 'hard') badgeHtml = '<span class="pos-badge" style="background:var(--accent-crimson-bg);color:var(--accent-crimson)">! Zor</span>';

    card.innerHTML = `
      <div class="dict-card-top">
        <div>
          <span class="rank-badge">#${index + 1}</span>
          <span class="pos-badge">${word.pos || 'Kelime'}</span>
          ${word.isCourse ? '<span class="course-badge">Ders</span>' : ''}
        </div>
        <div>${badgeHtml}</div>
      </div>
      <div>
        <span class="dict-card-word" lang="el">${word.fullForm || word.greek}</span>
        <span class="detail-pron"> /${word.pronunciation || ''}/</span>
      </div>
      <div class="dict-card-short">${word.shortMeaning}</div>
      <div class="dict-card-etym">✦ ${word.etymology || ''}</div>
    `;

    card.addEventListener('click', () => {
      switchMode('hafiz');
      setCurrentIndex(index);
    });

    listEl.appendChild(card);
  });
}

// ==================== GENEL İLERLEME VE ETKİLEŞİMLER ====================
function updateGlobalProgress() {
  const total = activeWords.length;
  const memorizedCount = activeWords.filter(w => state.wordStatus[w.id] === 'memorized').length;
  document.getElementById('memorizedStatsText').textContent = `${memorizedCount} / ${total} Ezberlendi`;
}

function toggleWordStatus(targetStatus) {
  if (activeWords.length === 0) return;
  const word = activeWords[state.currentIndex];
  const current = state.wordStatus[word.id];
  if (current === targetStatus) {
    delete state.wordStatus[word.id];
  } else {
    state.wordStatus[word.id] = targetStatus;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.STATUS, JSON.stringify(state.wordStatus));
  } catch (e) {}

  renderWheel();
  renderDetail();
  updateGlobalProgress();
}

function switchMode(newMode) {
  state.mode = newMode;
  document.getElementById('modeHafizBtn').classList.toggle('active', newMode === 'hafiz');
  document.getElementById('modeDictBtn').classList.toggle('active', newMode === 'dict');
  document.getElementById('hafizView').classList.toggle('active', newMode === 'hafiz');
  document.getElementById('dictView').classList.toggle('active', newMode === 'dict');
  renderAlphabetBar();
  renderCurrentView();
}

function renderCurrentView() {
  if (state.mode === 'hafiz') {
    renderWheel();
    renderDetail();
  } else {
    renderDictionary();
  }
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '☾' : '☼';
  saveLocalState();
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  applyTheme(state.theme);
  prepareWordPools();

  // Havuz seçimi
  document.getElementById('poolCourseBtn').addEventListener('click', () => updatePoolSelection('course'));
  document.getElementById('poolAllBtn').addEventListener('click', () => updatePoolSelection('all'));

  // Mod seçimi
  document.getElementById('modeHafizBtn').addEventListener('click', () => switchMode('hafiz'));
  document.getElementById('modeDictBtn').addEventListener('click', () => switchMode('dict'));

  // Tema değiştirme
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // Gizleme ve bulanıklaştırma anahtarları
  document.getElementById('hideMeaningsToggle').addEventListener('change', (e) => {
    state.hideMeanings = e.target.checked;
    renderWheel();
  });

  document.getElementById('blurNextToggle').addEventListener('change', (e) => {
    state.blurNext = e.target.checked;
    renderWheel();
  });

  // Anlık Göster (Peek) butonu
  const peekBtn = document.getElementById('peekBtn');
  const startPeek = () => {
    state.peeking = true;
    peekBtn.classList.add('peeking');
    document.getElementById('wheelDrum').classList.add('peeking');
  };
  const stopPeek = () => {
    state.peeking = false;
    peekBtn.classList.remove('peeking');
    document.getElementById('wheelDrum').classList.remove('peeking');
  };
  peekBtn.addEventListener('mousedown', startPeek);
  peekBtn.addEventListener('mouseup', stopPeek);
  peekBtn.addEventListener('mouseleave', stopPeek);
  peekBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPeek(); });
  peekBtn.addEventListener('touchend', stopPeek);

  // Çark ileri/geri butonları
  document.getElementById('prevWordBtn').addEventListener('click', () => setCurrentIndex(state.currentIndex - 1));
  document.getElementById('nextWordBtn').addEventListener('click', () => setCurrentIndex(state.currentIndex + 1));
  document.getElementById('neighborPrevCard').addEventListener('click', () => setCurrentIndex(state.currentIndex - 1));
  document.getElementById('neighborNextCard').addEventListener('click', () => setCurrentIndex(state.currentIndex + 1));

  // Sıraya git ve Rastgele
  document.getElementById('jumpInput').addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setCurrentIndex(val - 1);
  });

  document.getElementById('randomWordBtn').addEventListener('click', () => {
    if (activeWords.length > 1) {
      const r = Math.floor(Math.random() * activeWords.length);
      setCurrentIndex(r);
    }
  });

  // Ezber durumu işaretleme
  document.getElementById('markMemorizedBtn').addEventListener('click', () => toggleWordStatus('memorized'));
  document.getElementById('markHardBtn').addEventListener('click', () => toggleWordStatus('hard'));

  // Kişisel not kaydetme
  let noteTimeout = null;
  document.getElementById('personalNoteInput').addEventListener('input', (e) => {
    if (activeWords.length === 0) return;
    const word = activeWords[state.currentIndex];
    state.wordNotes[word.id] = e.target.value;
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.wordNotes));
    } catch (err) {}

    const indicator = document.getElementById('noteSavedIndicator');
    indicator.classList.add('show');
    clearTimeout(noteTimeout);
    noteTimeout = setTimeout(() => indicator.classList.remove('show'), 1400);
  });

  // Çark Fare Tekerleği (Mouse Wheel) Desteği
  const viewport = document.getElementById('wheelViewport');
  let wheelCooldown = false;
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (wheelCooldown) return;
    if (Math.abs(e.deltaY) < 6) return;

    const dir = e.deltaY > 0 ? 1 : -1;
    setCurrentIndex(state.currentIndex + dir);

    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 110);
  }, { passive: false });

  // Çark Dokunmatik / Fare Sürükleme Desteği
  let dragStartY = null;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.wheel-item')) {
      dragStartY = e.clientY;
    } else {
      dragStartY = e.clientY;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (dragStartY === null) return;
    const diff = dragStartY - e.clientY;
    if (Math.abs(diff) > 38) {
      const step = diff > 0 ? 1 : -1;
      setCurrentIndex(state.currentIndex + step);
      dragStartY = e.clientY;
    }
  });

  window.addEventListener('pointerup', () => {
    dragStartY = null;
  });

  // Klavye Kısayolları (↑, ↓, Boşluk, E, Z)
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (state.mode !== 'hafiz') return;

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      setCurrentIndex(state.currentIndex + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      setCurrentIndex(state.currentIndex - 1);
    } else if (e.code === 'Space') {
      e.preventDefault();
      startPeek();
    } else if (e.key === 'e' || e.key === 'E') {
      toggleWordStatus('memorized');
    } else if (e.key === 'z' || e.key === 'Z') {
      toggleWordStatus('hard');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      stopPeek();
    }
  });

  // Sözlük Modu Arama ve Filtreler
  const searchInput = document.getElementById('dictSearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  searchInput.addEventListener('input', (e) => {
    state.dictSearch = e.target.value;
    clearBtn.classList.toggle('hidden', !state.dictSearch);
    renderDictionary();
  });

  clearBtn.addEventListener('click', () => {
    state.dictSearch = '';
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    renderDictionary();
  });

  document.getElementById('statusFilterSelect').addEventListener('change', (e) => {
    state.dictStatusFilter = e.target.value;
    renderDictionary();
  });
});
