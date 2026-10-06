/**
 * FA → Regular Grammar Engine
 * Automates conversion of Deterministic Finite Automata (DFA)
 * into Right-Linear (G_R) and Left-Linear (G_L) Regular Grammars
 * with interactive step-by-step state diagram animation.
 */

/**
 * Site Preloader Controller
 * Orchestrates a smooth, high-tech automata loading screen with
 * simulated compilation steps, progress tracking, and seamless exit transition.
 */
const siteLoader = {
  el: null,
  fillEl: null,
  pctEl: null,
  msgEl: null,
  skipBtn: null,
  replayBtn: null,
  progress: 0,
  rafId: null,
  startTime: 0,
  totalDuration: 7500, // 7.5 seconds (in requested 7-8 second range)
  isDone: false,
  isLoadedEventFired: false,

  steps: [
    { threshold: 18, msg: 'Bootstrapping compiler environment & canvas...' },
    { threshold: 38, msg: 'Configuring DFA states Q = {q₀, q₁, ...} & alphabet Σ...' },
    { threshold: 58, msg: 'Computing transition function δ : Q × Σ → Q...' },
    { threshold: 80, msg: 'Synthesizing Right-Linear & Left-Linear Grammars...' },
    { threshold: 96, msg: 'Compiling state diagram & interactive visualizer...' },
    { threshold: 100, msg: 'Engine ready. Launching workspace...' }
  ],

  start() {
    if (this._hasStarted) return;
    this._hasStarted = true;
    this.startTime = Date.now();
    this.el = document.getElementById('site-loader');
    this.fillEl = document.getElementById('loaderFill');
    this.pctEl = document.getElementById('loaderPct');
    this.msgEl = document.getElementById('loaderLogMsg');
    this.skipBtn = document.getElementById('loaderSkipBtn');
    this.replayBtn = document.getElementById('replayLoaderBtn');

    if (!this.el) return;

    this.initEvents();

    this.progress = 0;
    this.isDone = false;
    this.loop();

    // Fallback safety timeout (totalDuration + 2.5s)
    setTimeout(() => {
      if (!this.isDone) this.finish();
    }, this.totalDuration + 2500);
  },

  loop() {
    if (this.isDone) return;

    const elapsed = Date.now() - this.startTime;
    const ratio = Math.min(1, elapsed / this.totalDuration);

    // Organic progressive curve over 7.5 seconds
    const eased = Math.pow(ratio, 0.94);
    this.progress = Math.min(100, eased * 100);

    this.render();

    if (elapsed >= this.totalDuration) {
      this.progress = 100;
      this.render();
      this.complete();
      return;
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  },

  render() {
    const rounded = Math.min(100, Math.floor(this.progress));
    if (this.fillEl) this.fillEl.style.width = `${rounded}%`;
    if (this.pctEl) this.pctEl.textContent = `${rounded}%`;

    if (this.msgEl) {
      for (let i = 0; i < this.steps.length; i++) {
        if (rounded <= this.steps[i].threshold || i === this.steps.length - 1) {
          if (this.msgEl.textContent !== this.steps[i].msg) {
            this.msgEl.textContent = this.steps[i].msg;
          }
          break;
        }
      }
    }
  },

  onPageLoad() {
    this.isLoadedEventFired = true;
    // Animation progresses gracefully until totalDuration (7.5s) completes
  },

  finish() {
    if (this.isDone) return;
    this.progress = 100;
    this.render();
    this.complete();
  },

  complete() {
    if (this.isDone) return;
    this.isDone = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);

    if (this.msgEl) this.msgEl.textContent = 'Engine ready. Launching workspace...';
    if (this.pctEl) this.pctEl.textContent = '100%';
    if (this.fillEl) this.fillEl.style.width = '100%';

    // Play subtle audio confirmation if sound engine is active
    try {
      if (typeof soundEngine !== 'undefined' && soundEngine.enabled && soundEngine.ctx && soundEngine.ctx.state === 'running') {
        soundEngine.playAccept();
      }
    } catch (e) {}

    setTimeout(() => {
      if (this.el) {
        this.el.classList.add('is-loaded');
        this.el.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
          this.el.style.display = 'none';
        }, 460);
      }
    }, 180);
  },

  initEvents() {
    if (this._eventsInited) return;
    this._eventsInited = true;

    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.finish();
      });
    }

    if (this.el) {
      this.el.addEventListener('click', (e) => {
        if (e.target === this.el || (e.target.classList && e.target.classList.contains('loader-ambient-glow'))) {
          this.finish();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (!this.isDone && (e.key === 'Escape' || e.key === 'Enter')) {
        this.finish();
      }
    });

    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => {
        this.replay();
      });
    }
  },

  replay() {
    if (!this.el) return;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.isDone = false;
    this.isLoadedEventFired = false;
    this.progress = 0;
    this.startTime = Date.now();
    this.el.style.display = 'flex';
    this.el.setAttribute('aria-hidden', 'false');
    // Force reflow
    void this.el.offsetWidth;
    this.el.classList.remove('is-loaded');
    this.loop();
  }
};

// Immediate start of loader tracking
if (document.getElementById('site-loader')) {
  siteLoader.start();
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => siteLoader.start());
} else {
  siteLoader.start();
}

if (document.readyState === 'complete') {
  siteLoader.onPageLoad();
} else {
  window.addEventListener('load', () => siteLoader.onPageLoad());
}

window.replayLoader = () => siteLoader.replay();

const EPS = 'ε';
let cfg = {
  n: 3,
  alphabet: ['0', '1'],
  start: 'q0',
  finals: new Set(['q2'])
};

// Simulation state for step-by-step animation
let simState = {
  string: '',
  symbols: [],
  steps: [], // [{ stepIndex, from, sym, to, state, valid, accepted }]
  currentStep: -1,
  isPlaying: false,
  timer: null,
  speed: 800,
  tokenAnimId: null
};

/**
 * Procedural Web Audio Sound Engine
 * Synthesizes harmonic audio feedback for state transitions, accept/reject verdicts,
 * tape head steps, and ambient canvas ripples with zero external audio assets.
 */
const soundEngine = {
  ctx: null,
  enabled: true,
  densityIndex: 2, // Default: High (100%)
  densityLevels: [
    { key: 'soft', label: 'Soft (40%)', mult: 0.5, oscs: 1, detune: 0 },
    { key: 'mid', label: 'Mid (70%)', mult: 0.85, oscs: 1, detune: 0 },
    { key: 'high', label: 'High (100%)', mult: 1.25, oscs: 2, detune: 6 },
    { key: 'ultra', label: 'Ultra (150%)', mult: 1.75, oscs: 3, detune: 10 }
  ],

  init() {
    const saved = localStorage.getItem('toc_sound');
    this.enabled = saved !== 'false';

    const savedDensity = localStorage.getItem('toc_sound_density');
    if (savedDensity) {
      const idx = this.densityLevels.findIndex(d => d.key === savedDensity);
      if (idx !== -1) this.densityIndex = idx;
    }
    this.updateUI();

    const btn = document.getElementById('soundToggleBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.getAudioContext();
        this.toggle();
      });
    }

    const densityBtn = document.getElementById('soundDensityBtn');
    if (densityBtn) {
      densityBtn.addEventListener('click', () => {
        this.getAudioContext();
        this.increaseDensity();
      });
    }

    const unlock = () => {
      this.getAudioContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
  },

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  increaseDensity() {
    this.densityIndex = (this.densityIndex + 1) % this.densityLevels.length;
    const current = this.densityLevels[this.densityIndex];
    try {
      localStorage.setItem('toc_sound_density', current.key);
    } catch (e) {}
    this.updateUI();
    // Play preview tone with the newly selected density and harmonics
    this.playTone(523.25, 'triangle', 0.16, 0.14);
  },

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('toc_sound', this.enabled ? 'true' : 'false');
    } catch (e) {}
    this.updateUI();
    if (this.enabled) {
      this.playStep(2);
    }
  },

  updateUI() {
    const btn = document.getElementById('soundToggleBtn');
    if (btn) {
      btn.classList.toggle('muted', !this.enabled);
      btn.innerHTML = this.enabled
        ? `<span class="sound-icon">🔊</span> Sound ON`
        : `<span class="sound-icon">🔇</span> Sound OFF`;
    }

    const densityVal = document.getElementById('densityVal');
    if (densityVal) {
      const current = this.densityLevels[this.densityIndex];
      densityVal.textContent = current.label;
    }
  },

  playTone(freq, type, duration, gainLevel = 0.12) {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const current = this.densityLevels[this.densityIndex];
      const effectiveGain = gainLevel * current.mult;

      // Master Gain Envelope
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(effectiveGain, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      masterGain.connect(ctx.destination);

      // Primary Oscillator
      const osc1 = ctx.createOscillator();
      osc1.type = type || 'sine';
      osc1.frequency.setValueAtTime(freq, ctx.currentTime);
      osc1.connect(masterGain);
      osc1.start();
      osc1.stop(ctx.currentTime + duration);

      // Secondary Detuned Oscillator (Layered for High & Ultra density)
      if (current.oscs >= 2) {
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq, ctx.currentTime);
        osc2.detune.setValueAtTime(current.detune * 8, ctx.currentTime);

        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0.65, ctx.currentTime);
        osc2.connect(gain2);
        gain2.connect(masterGain);

        osc2.start();
        osc2.stop(ctx.currentTime + duration);
      }

      // Harmonic Octave Overtone Oscillator (Layered for Ultra density)
      if (current.oscs >= 3) {
        const osc3 = ctx.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(freq * 2, ctx.currentTime);

        const gain3 = ctx.createGain();
        gain3.gain.setValueAtTime(0.35, ctx.currentTime);
        osc3.connect(gain3);
        gain3.connect(masterGain);

        osc3.start();
        osc3.stop(ctx.currentTime + duration);
      }
    } catch (e) {}
  },

  playStep(stepIdx) {
    if (!this.enabled) return;
    // Ascending cybernetic pentatonic scale
    const scale = [329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
    const freq = scale[(stepIdx || 0) % scale.length];
    this.playTone(freq, 'triangle', 0.1, 0.1);
  },

  playAccept() {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Triumphant ascending major arpeggio: C5, E5, G5, C6
    const chord = [523.25, 659.25, 783.99, 1046.50];
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.35, 0.14);
      }, idx * 85);
    });
  },

  playReject() {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.28);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch (e) {}
  },

  playRipple() {
    if (!this.enabled) return;
    this.playTone(650 + Math.random() * 200, 'sine', 0.15, 0.03);
  }
};

/**
 * Initializes and manages theme selection (Dark, Midnight, Light).
 */
function initTheme() {
  const savedTheme = localStorage.getItem('toc_theme') || 'dark';
  setTheme(savedTheme);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeVal;
      if (theme) {
        setTheme(theme);
      }
    });
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('toc_theme', theme);
  } catch (e) {
    // Graceful fallback
  }
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeVal === theme);
  });
}

/**
 * Generates an array of state labels [q0, q1, ..., q(n-1)]
 * @param {number} n - Number of states
 * @returns {string[]}
 */
function stateNames(n) {
  return Array.from({ length: n }, (_, i) => 'q' + i);
}

/**
 * Rebuilds the transition table UI based on current states and alphabet inputs.
 */
function buildTable() {
  const n = Math.max(1, Math.min(12, parseInt(document.getElementById('numStates').value, 10) || 1));
  const alpha = document.getElementById('alphabet').value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  cfg.n = n;
  cfg.alphabet = alpha.length ? alpha : ['0', '1'];

  const states = stateNames(n);
  if (!states.includes(cfg.start)) {
    cfg.start = states[0];
  }
  cfg.finals = new Set([...cfg.finals].filter(f => states.includes(f)));

  const table = document.getElementById('ttable');
  let html = '<thead><tr><th>δ</th>';
  cfg.alphabet.forEach(a => {
    html += `<th>${escapeHtml(a)}</th>`;
  });
  html += '</tr></thead><tbody>';

  states.forEach(q => {
    html += `<tr><td class="state-label">${q}
      <div class="state-flags">
        <span class="flag-chip start ${cfg.start === q ? 'on' : ''}" data-state="${q}" data-role="start">start</span>
        <span class="flag-chip final ${cfg.finals.has(q) ? 'on' : ''}" data-state="${q}" data-role="final">final</span>
      </div>
    </td>`;
    cfg.alphabet.forEach(a => {
      html += `<td><select data-from="${q}" data-sym="${escapeAttr(a)}">`;
      html += `<option value="">∅</option>`;
      states.forEach(r => {
        const sel = (window.__lastTrans && window.__lastTrans[q] && window.__lastTrans[q][a] === r) ? 'selected' : '';
        html += `<option value="${r}" ${sel}>${r}</option>`;
      });
      html += `</select></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;

  table.querySelectorAll('.flag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const s = chip.dataset.state;
      const role = chip.dataset.role;
      if (role === 'start') {
        cfg.start = s;
      } else {
        if (cfg.finals.has(s)) {
          cfg.finals.delete(s);
        } else {
          cfg.finals.add(s);
        }
      }
      refreshFlags();
    });
  });
}

/**
 * Updates UI active classes for start/final status chips.
 */
function refreshFlags() {
  document.querySelectorAll('.flag-chip').forEach(chip => {
    const s = chip.dataset.state;
    const role = chip.dataset.role;
    if (role === 'start') {
      chip.classList.toggle('on', cfg.start === s);
    } else {
      chip.classList.toggle('on', cfg.finals.has(s));
    }
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/**
 * Reads user selections from the HTML transition table.
 * @returns {Record<string, Record<string, string>>} Transition mapping
 */
function readTransitions() {
  const trans = {};
  document.querySelectorAll('#ttable select').forEach(sel => {
    const from = sel.dataset.from;
    const sym = sel.dataset.sym;
    const to = sel.value;
    if (!trans[from]) trans[from] = {};
    if (to) trans[from][sym] = to;
  });
  window.__lastTrans = trans;
  return trans;
}

/**
 * Generates both Right-Linear and Left-Linear grammars and updates diagram.
 */
function generate() {
  pauseSimulation();
  resetSimulationUI();

  const trans = readTransitions();
  const states = stateNames(cfg.n);
  const alpha = cfg.alphabet;
  const start = cfg.start;
  const finals = cfg.finals;

  // Right-linear rules: A -> aB for delta(A, a) = B, and A -> epsilon for A in F
  const rlRules = [];
  states.forEach(q => {
    alpha.forEach(a => {
      if (trans[q] && trans[q][a]) {
        rlRules.push({ lhs: q, sym: a, rhs: trans[q][a] });
      }
    });
  });
  const rlEps = states.filter(f => finals.has(f));

  // Left-linear rules: B -> Aa for delta(A, a) = B, q0 -> epsilon, S -> F for F in finals
  const llRules = [];
  states.forEach(q => {
    alpha.forEach(a => {
      if (trans[q] && trans[q][a]) {
        const r = trans[q][a];
        llRules.push({ lhs: r, base: q, sym: a });
      }
    });
  });

  renderGrammars(states, alpha, start, finals, rlRules, rlEps, llRules);
  drawDiagram(states, alpha, start, finals, trans);
  window.__engine = { states, alpha, start, finals, trans };
  document.getElementById('derivationGrid').innerHTML = '';
  document.getElementById('verdict').className = 'verdict';
  if (typeof historyManager !== 'undefined') {
    historyManager.recordSnapshot('generate');
  }
}

/**
 * Renders mathematical formal specification and production rules in cards.
 */
function renderGrammars(states, alpha, start, finals, rlRules, rlEps, llRules) {
  const V = states.join(', ');
  const S = alpha.join(', ');

  // Right-linear card
  let rlHtml = `<div class="grammar-card">
    <div class="grammar-head"><span class="dot right"></span><h3>Right-Linear Grammar G<sub>R</sub></h3></div>
    <div class="grammar-formal">
      <span class="k">V</span> = { ${V} }<br>
      <span class="k">Σ</span> = { ${S} }<br>
      <span class="k">Start</span> = ${start}<br>
      <span class="k">Rule form</span> = A → aB | ε
    </div>
    <div class="rules">`;
  rlRules.forEach(r => {
    rlHtml += `<div class="r"><span class="lhs">${r.lhs}</span><span class="arrow">→</span><span class="sym">${escapeHtml(r.sym)}</span><span class="rhs">${r.rhs}</span></div>`;
  });
  rlEps.forEach(f => {
    rlHtml += `<div class="r"><span class="lhs">${f}</span><span class="arrow">→</span><span class="eps">ε</span></div>`;
  });
  if (rlRules.length === 0 && rlEps.length === 0) {
    rlHtml += `<div class="r" style="color:var(--muted-2)">(no rules — empty δ)</div>`;
  }
  rlHtml += `</div></div>`;

  // Left-linear card
  let llHtml = `<div class="grammar-card">
    <div class="grammar-head"><span class="dot left"></span><h3>Left-Linear Grammar G<sub>L</sub></h3></div>
    <div class="grammar-formal">
      <span class="k">V</span> = { ${V}, S }<br>
      <span class="k">Σ</span> = { ${S} }<br>
      <span class="k">Start</span> = S<br>
      <span class="k">Rule form</span> = A → Ba | ε
    </div>
    <div class="rules">`;
  llRules.forEach(r => {
    llHtml += `<div class="r"><span class="lhs">${r.lhs}</span><span class="arrow">→</span><span class="rhs">${r.base}</span><span class="sym l">${escapeHtml(r.sym)}</span></div>`;
  });
  llHtml += `<div class="r"><span class="lhs">${start}</span><span class="arrow">→</span><span class="eps">ε</span></div>`;
  [...finals].forEach(f => {
    llHtml += `<div class="r"><span class="lhs">S</span><span class="arrow">→</span><span class="rhs">${f}</span></div>`;
  });
  llHtml += `</div></div>`;

  document.getElementById('outputGrid').innerHTML = rlHtml + llHtml;
}

/**
 * Draws state diagram SVG with self loops, curved edges, animation layers and node flags.
 */
function drawDiagram(states, alpha, start, finals, trans) {
  const svg = document.getElementById('diagram');
  const W = 700;
  const H = 300;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const n = states.length;
  const cx = W / 2;
  const cy = H / 2 + 10;
  const R = Math.min(W, H) / 2 - 70;
  const pos = {};

  states.forEach((s, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    pos[s] = { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  });
  window.__diagramPos = pos;

  // group edges by (from,to)
  const edgeMap = {};
  states.forEach(q => {
    alpha.forEach(a => {
      if (trans[q] && trans[q][a]) {
        const to = trans[q][a];
        const key = q + '|' + to;
        if (!edgeMap[key]) edgeMap[key] = { from: q, to, syms: [] };
        edgeMap[key].syms.push(a);
      }
    });
  });

  let defs = `<defs>
    <marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--muted-2)"/>
    </marker>
    <marker id="start-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--accent)"/>
    </marker>
  </defs>`;

  let edgesSvg = '';
  const nodeR = 24;

  Object.values(edgeMap).forEach(e => {
    const label = e.syms.join(',');
    if (e.from === e.to) {
      // self loop
      const p = pos[e.from];
      const d = `M ${p.x - 10},${p.y - nodeR + 2} C ${p.x - 30},${p.y - nodeR - 45} ${p.x + 30},${p.y - nodeR - 45} ${p.x + 10},${p.y - nodeR + 2}`;
      edgesSvg += `<path id="edge-path-${e.from}-${e.to}" class="edge-path" data-from="${e.from}" data-to="${e.to}" d="${d}" fill="none" stroke="var(--border)" stroke-width="1.8" marker-end="url(#arrow)"/>`;
      edgesSvg += `<path id="edge-flow-${e.from}-${e.to}" class="edge-flow" d="${d}" fill="none" stroke="var(--accent2)" stroke-width="2.5"/>`;
      edgesSvg += `<text id="edge-text-${e.from}-${e.to}" x="${p.x}" y="${p.y - nodeR - 32}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--accent)">${escapeHtml(label)}</text>`;
    } else {
      const p1 = pos[e.from];
      const p2 = pos[e.to];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / dist;
      const uy = dy / dist;
      const sx = p1.x + ux * nodeR;
      const sy = p1.y + uy * nodeR;
      const ex = p2.x - ux * nodeR;
      const ey = p2.y - uy * nodeR;
      const mx = (sx + ex) / 2 - uy * 18;
      const my = (sy + ey) / 2 + ux * 18;
      const d = `M ${sx},${sy} Q ${mx},${my} ${ex},${ey}`;

      edgesSvg += `<path id="edge-path-${e.from}-${e.to}" class="edge-path" data-from="${e.from}" data-to="${e.to}" d="${d}" fill="none" stroke="var(--border)" stroke-width="1.8" marker-end="url(#arrow)"/>`;
      edgesSvg += `<path id="edge-flow-${e.from}-${e.to}" class="edge-flow" d="${d}" fill="none" stroke="var(--accent2)" stroke-width="2.5"/>`;
      edgesSvg += `<text id="edge-text-${e.from}-${e.to}" x="${mx}" y="${my}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--accent)">${escapeHtml(label)}</text>`;
    }
  });

  let nodesSvg = '';
  states.forEach(q => {
    const p = pos[q];
    const isStart = q === start;
    const isFinal = finals.has(q);

    nodesSvg += `<g id="node-group-${q}" class="node-group" data-state="${q}">`;
    if (isStart) {
      const ang = Math.atan2(p.y - cy, p.x - cx);
      const sx = p.x - Math.cos(ang) * (nodeR + 30);
      const sy = p.y - Math.sin(ang) * (nodeR + 30);
      const ex = p.x - Math.cos(ang) * (nodeR + 2);
      const ey = p.y - Math.sin(ang) * (nodeR + 2);
      nodesSvg += `<path d="M ${sx},${sy} L ${ex},${ey}" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#start-arrow)"/>`;
    }
    if (isFinal) {
      nodesSvg += `<circle id="final-ring-${q}" cx="${p.x}" cy="${p.y}" r="${nodeR + 5}" fill="none" stroke="var(--accent2)" stroke-width="1.8"/>`;
    }
    nodesSvg += `<circle id="node-circle-${q}" class="node-circle" cx="${p.x}" cy="${p.y}" r="${nodeR}" fill="var(--panel)" stroke="${isStart ? 'var(--accent)' : 'var(--border)'}" stroke-width="${isStart ? 2.5 : 1.5}"/>`;
    nodesSvg += `<text id="node-text-${q}" x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="13" fill="var(--ink)" font-weight="600">${q}</text>`;
    nodesSvg += `</g>`;
  });

  // Animated ripple ring and moving token
  const animSvg = `
    <circle id="active-ring" cx="-100" cy="-100" r="26" fill="none" stroke="var(--accent)" class="ripple-ring" style="display:none;"></circle>
    <circle id="sim-token" cx="-100" cy="-100" r="7" fill="var(--accent)" stroke="#FFFFFF" stroke-width="1.5" style="display:none;"></circle>
  `;

  svg.innerHTML = defs + edgesSvg + nodesSvg + animSvg;
}

/**
 * Diagnoses rejection cause and generates formal academic explanation.
 */
function buildRejectionDiagnosis(eng, str, symbols, path, ok, failStep, cur) {
  const finalsList = [...eng.finals];
  const finalsDisplay = finalsList.length ? finalsList.join(', ') : '∅';
  const pathDisplay = path.length ? path.join(' → ') : eng.start;

  // Case 1: Empty string rejected
  if (symbols.length === 0 && !eng.finals.has(eng.start)) {
    return {
      cause: 'Empty String (ε) Not Accepted',
      badge: 'Start State ∉ F',
      pathDisplay: eng.start,
      stuckForm: eng.start,
      automatonExplanation: `The input is an empty string (w = ε). Computation remains at start state <strong>${eng.start}</strong>, which is not marked as an accepting state (${eng.start} ∉ F).`,
      grammarExplanation: `In Right-Linear Grammar <code>G<sub>R</sub></code>, for ε to be generated, the start variable <code>${eng.start}</code> must possess an ε-production rule (<code>${eng.start} → ε</code>), which is only generated when <code>${eng.start} ∈ F</code>.`,
      formalMath: `δ*(q₀, ε) = ${eng.start} ∉ F  ⟹  ε ∉ L(M)`,
      fixHint: `Mark start state <code>${eng.start}</code> as an accepting (final) state if the language should recognize the empty string ε.`
    };
  }

  // Case 2: Invalid Alphabet Symbol
  if (failStep && failStep.sym && !eng.alpha.includes(failStep.sym)) {
    return {
      cause: `Invalid Symbol '${escapeHtml(failStep.sym)}'`,
      badge: 'Symbol ∉ Σ',
      pathDisplay: pathDisplay,
      stuckForm: str.slice(0, failStep.stepIndex - 1) + failStep.from,
      automatonExplanation: `The symbol <strong>'${escapeHtml(failStep.sym)}'</strong> at position ${failStep.stepIndex} does not belong to the defined alphabet <code>Σ = { ${escapeHtml(eng.alpha.join(', '))} }</code>. By definition, finite automata only process strings over Σ.`,
      grammarExplanation: `Production rules in both <code>G<sub>R</sub></code> and <code>G<sub>L</sub></code> only contain terminals from <code>Σ</code>. No production exists that can consume or generate the symbol <code>'${escapeHtml(failStep.sym)}'</code>.`,
      formalMath: `∃ a ∈ w such that a ∉ Σ  ⟹  w ∉ Σ*`,
      fixHint: `Ensure the input string contains only symbols from alphabet <code>{ ${escapeHtml(eng.alpha.join(', '))} }</code> or add <code>'${escapeHtml(failStep.sym)}'</code> to the Alphabet field.`
    };
  }

  // Case 3: Missing / Undefined Transition
  if (failStep && failStep.from && failStep.sym && !failStep.valid) {
    return {
      cause: `Undefined Transition δ(${failStep.from}, '${escapeHtml(failStep.sym)}')`,
      badge: 'Trapped at ∅',
      pathDisplay: pathDisplay + ` ──[${escapeHtml(failStep.sym)}]──✖`,
      stuckForm: str.slice(0, failStep.stepIndex - 1) + failStep.from,
      automatonExplanation: `In state <strong>${failStep.from}</strong>, reading symbol <strong>'${escapeHtml(failStep.sym)}'</strong> has no defined transition (cell is <code>∅</code>). The DFA halts abruptly before reading the entire string.`,
      grammarExplanation: `In Right-Linear Grammar <code>G<sub>R</sub></code>, there is no production rule with left-hand side <code>${failStep.from}</code> and terminal <code>'${escapeHtml(failStep.sym)}'</code> (i.e., no rule <code>${failStep.from} → ${escapeHtml(failStep.sym)}X</code>). The derivation tree cannot be expanded.`,
      formalMath: `δ(${failStep.from}, '${escapeHtml(failStep.sym)}') = ∅  ⟹  Computation Halted Prematurely`,
      fixHint: `Define a target state for <code>δ(${failStep.from}, '${escapeHtml(failStep.sym)}')</code> in the transition table, or redirect it to a trap/sink state.`
    };
  }

  // Case 4: Processed all symbols, but ended in a non-final state
  return {
    cause: `Ended in Non-Accepting State (${cur} ∉ F)`,
    badge: 'Non-Final Terminal State',
    pathDisplay: pathDisplay,
    stuckForm: str + cur,
    automatonExplanation: `The string was successfully processed through ${symbols.length} transition(s), terminating in state <strong>${cur}</strong>. However, the accepting states set is <code>F = { ${finalsDisplay} }</code>, and <strong>${cur}</strong> is not an accepting state.`,
    grammarExplanation: `In Right-Linear Grammar <code>G<sub>R</sub></code>, the derivation reaches the sentential form <code>${escapeHtml(str)}${cur}</code>. Because <code>${cur} ∉ F</code>, there is no ε-rule (<code>${cur} → ε</code>) to eliminate the trailing non-terminal variable <code>${cur}</code>. The string cannot resolve to terminals only.`,
    formalMath: `δ*(q₀, "${escapeHtml(str)}") = ${cur} ∉ F  ⟹  w ∉ L(M)`,
    fixHint: `To accept, the string must navigate to an accepting state in <code>{ ${finalsDisplay} }</code>, or click the <strong>final</strong> chip under <code>${cur}</code> in the table to designate it an accepting state.`
  };
}

/**
 * Validates the test string against the DFA, builds derivation trace, and initializes animation.
 */
function runTest(autoPlay = false) {
  const eng = window.__engine;
  const verdictEl = document.getElementById('verdict');
  const derivGrid = document.getElementById('derivationGrid');
  if (!eng) {
    verdictEl.className = 'verdict reject';
    verdictEl.textContent = 'Generate the grammars first.';
    return;
  }

  pauseSimulation();

  const str = document.getElementById('testString').value;
  const symbols = str.length ? str.split('') : [];
  let cur = eng.start;
  const path = [cur];
  const steps = [];
  let failStep = null;

  // Step 0: Initial state before consuming any character
  steps.push({
    stepIndex: 0,
    from: null,
    sym: null,
    to: cur,
    state: cur,
    valid: true,
    accepted: symbols.length === 0 && eng.finals.has(cur)
  });

  let ok = true;
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const from = cur;
    if (!eng.alpha.includes(sym)) {
      ok = false;
      failStep = {
        stepIndex: i + 1,
        from,
        sym,
        to: null,
        state: from,
        valid: false,
        accepted: false
      };
      steps.push(failStep);
      break;
    }
    const next = eng.trans[cur] && eng.trans[cur][sym];
    if (!next) {
      ok = false;
      failStep = {
        stepIndex: i + 1,
        from,
        sym,
        to: null,
        state: from,
        valid: false,
        accepted: false
      };
      steps.push(failStep);
      break;
    }
    cur = next;
    path.push(cur);
    steps.push({
      stepIndex: i + 1,
      from,
      sym,
      to: next,
      state: next,
      valid: true,
      accepted: (i === symbols.length - 1) && eng.finals.has(next)
    });
  }

  const accepted = ok && eng.finals.has(cur);

  if (accepted) {
    verdictEl.className = 'verdict accept';
    verdictEl.innerHTML = `<strong>✔ Accepted</strong> — String successfully recognized. Path: <code>${path.join(' → ')}</code>`;

    // Right-linear derivation
    let rl = `<div class="grammar-card"><div class="grammar-head"><span class="dot right"></span><h3>Right-Linear Grammar G<sub>R</sub> Derivation</h3></div><div class="derivation">`;
    let sofar = '';
    let line = eng.start;
    rl += `<div class="step" data-step="0">${line}</div>`;
    symbols.forEach((sym, i) => {
      sofar += sym;
      line = `${sofar}${path[i + 1]}`;
      rl += `<div class="step" data-step="${i + 1}">⇒ <span class="sym">${escapeHtml(sofar)}</span>${path[i + 1]}</div>`;
    });
    rl += `<div class="step" data-step="${symbols.length}">⇒ <span class="sym">${escapeHtml(sofar)}</span> <span style="color:var(--danger)">(ε)</span></div>`;
    rl += `</div></div>`;

    // Left-linear derivation (built from S, unwinding backward)
    let ll = `<div class="grammar-card"><div class="grammar-head"><span class="dot left"></span><h3>Left-Linear Grammar G<sub>L</sub> Derivation</h3></div><div class="derivation">`;
    ll += `<div class="step" data-step="0">S</div>`;
    ll += `<div class="step" data-step="0">⇒ ${path[path.length - 1]}</div>`;
    let suffix = '';
    for (let i = symbols.length - 1; i >= 0; i--) {
      suffix = symbols[i] + suffix;
      const base = path[i];
      ll += `<div class="step" data-step="${i + 1}">⇒ ${base}<span class="sym l">${escapeHtml(suffix)}</span></div>`;
    }
    ll += `<div class="step" data-step="${symbols.length}">⇒ <span style="color:var(--danger)">(ε)</span><span class="sym l">${escapeHtml(suffix)}</span></div>`;
    ll += `</div></div>`;

    derivGrid.innerHTML = rl + ll;
  } else {
    // Rejection Diagnosis & Formal Explanation
    const diag = buildRejectionDiagnosis(eng, str, symbols, path, ok, failStep, cur);

    verdictEl.className = 'verdict reject';
    verdictEl.innerHTML = `<strong>✖ Rejected</strong> — ${diag.cause}. Ended in state <code>${cur}</code> (Path: <code>${path.join(' → ')}</code>)`;

    let diagHtml = `
      <div class="rejection-analysis-card" style="grid-column: 1 / -1;">
        <div class="rejection-header">
          <div class="rejection-title">
            <span>⚠️</span> Rejection Analysis &amp; Explanation: ${diag.cause}
          </div>
          <span class="rejection-badge">${diag.badge}</span>
        </div>

        <div class="rejection-columns">
          <div class="rejection-section">
            <div class="rejection-sec-title"><span>🔍</span> Automaton Execution Breakdown</div>
            <div class="rejection-sec-content">
              <div><strong>Path Traversed:</strong> <span class="path-chain">${diag.pathDisplay}</span></div>
              <div style="margin-top:6px;"><strong>Terminal State:</strong> <span class="err-state">${cur}</span> ${eng.finals.has(cur) ? '(Accepting)' : '(Non-Accepting)'}</div>
              <div style="margin-top:6px;"><strong>Accepting States F:</strong> <code>{ ${[...eng.finals].join(', ') || '∅'} }</code></div>
              <div style="margin-top:8px; color:var(--ink);">${diag.automatonExplanation}</div>
            </div>
          </div>

          <div class="rejection-section">
            <div class="rejection-sec-title"><span>📐</span> Grammar Derivation Failure Insight</div>
            <div class="rejection-sec-content">
              <div><strong>Stuck Sentential Form:</strong> <code>${escapeHtml(diag.stuckForm)}</code></div>
              <div style="margin-top:8px; color:var(--ink);">${diag.grammarExplanation}</div>
              <div style="margin-top:8px;"><strong>Formal Condition:</strong> <code>${diag.formalMath}</code></div>
            </div>
          </div>
        </div>

        <div class="rejection-hint">
          <span class="hint-icon">💡</span>
          <div><strong>Correction Hint:</strong> ${diag.fixHint}</div>
        </div>
      </div>
    `;

    // Partial Right-Linear trace up to failure point
    let partialRl = `<div class="grammar-card"><div class="grammar-head"><span class="dot right"></span><h3>G<sub>R</sub> Partial Sentential Trace (Halted)</h3></div><div class="derivation">`;
    let sofar = '';
    let line = eng.start;
    partialRl += `<div class="step" data-step="0">${line}</div>`;
    for (let i = 0; i < path.length - 1; i++) {
      sofar += symbols[i];
      partialRl += `<div class="step" data-step="${i + 1}">⇒ <span class="sym">${escapeHtml(sofar)}</span>${path[i + 1]}</div>`;
    }
    partialRl += `<div class="step" style="color:var(--danger);font-weight:600;">✖ Stuck at non-terminal '${cur}' (no cancellation rule '${cur} → ε')</div>`;
    partialRl += `</div></div>`;

    let partialLl = `<div class="grammar-card"><div class="grammar-head"><span class="dot left"></span><h3>G<sub>L</sub> Generation Infeasibility</h3></div><div class="derivation" style="font-size:12px;line-height:1.7;">`;
    partialLl += `<div class="step" style="color:var(--muted);">In Left-Linear Grammar G<sub>L</sub>, all valid derivations must begin with rule <code>S → q<sub>f</sub></code> where <code>q<sub>f</sub> ∈ F</code>.</div>`;
    partialLl += `<div class="step" style="color:var(--danger);margin-top:6px;">✖ Since terminal state <code>${cur} ∉ F</code>, no rule <code>S → ${cur}</code> exists in P<sub>L</sub>.</div>`;
    partialLl += `<div class="step" style="color:var(--muted);margin-top:6px;">Therefore, no sentential form can generate string "<code>${escapeHtml(str)}</code>".</div>`;
    partialLl += `</div></div>`;

    derivGrid.innerHTML = diagHtml + partialRl + partialLl;
  }

  // Setup simulation state and tape
  setupSimulation(str, symbols, steps);

  if (autoPlay) {
    playSimulation();
  } else {
    goToStep(0, false);
  }

  if (typeof historyManager !== 'undefined') {
    historyManager.recordSnapshot('test', accepted ? '✔ Accepted' : '✖ Rejected');
  }
}

/**
 * Initializes the input tape and playback controls for the string.
 */
function setupSimulation(str, symbols, steps) {
  simState.string = str;
  simState.symbols = symbols;
  simState.steps = steps;
  simState.currentStep = -1;

  // Render tape cells
  const tapeCellsEl = document.getElementById('tapeCells');
  if (symbols.length === 0) {
    tapeCellsEl.innerHTML = `<div class="tape-cell" id="tape-cell-0" title="Empty string ε">ε</div>`;
  } else {
    let cellsHtml = '';
    symbols.forEach((sym, i) => {
      cellsHtml += `<div class="tape-cell" id="tape-cell-${i}">${escapeHtml(sym)}</div>`;
    });
    tapeCellsEl.innerHTML = cellsHtml;
  }

  // Enable controls
  document.getElementById('animResetBtn').disabled = false;
  document.getElementById('animPrevBtn').disabled = false;
  document.getElementById('animPlayBtn').disabled = false;
  document.getElementById('animNextBtn').disabled = false;
}

/**
 * Resets the simulation UI when grammar is regenerated or table is rebuilt.
 */
function resetSimulationUI() {
  simState.steps = [];
  simState.currentStep = -1;
  simState.isPlaying = false;
  if (simState.timer) clearTimeout(simState.timer);
  if (simState.tokenAnimId) cancelAnimationFrame(simState.tokenAnimId);

  const tapeCells = document.getElementById('tapeCells');
  if (tapeCells) {
    tapeCells.innerHTML = `<span class="tape-placeholder">— enter string below &amp; click Run or Animate —</span>`;
  }
  const resetBtn = document.getElementById('animResetBtn');
  if (resetBtn) resetBtn.disabled = true;
  const prevBtn = document.getElementById('animPrevBtn');
  if (prevBtn) prevBtn.disabled = true;
  const playBtn = document.getElementById('animPlayBtn');
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.textContent = '▶ Play';
  }
  const nextBtn = document.getElementById('animNextBtn');
  if (nextBtn) nextBtn.disabled = true;

  const statusText = document.getElementById('statusText');
  if (statusText) statusText.textContent = 'Ready';
  const statusDot = document.getElementById('statusDot');
  if (statusDot) statusDot.className = 'status-dot';
}

/**
 * Moves simulation to a specific step index with full visual animations.
 */
function goToStep(stepIdx, animateMove = true) {
  if (!simState.steps || simState.steps.length === 0) return;

  stepIdx = Math.max(0, Math.min(simState.steps.length - 1, stepIdx));
  simState.currentStep = stepIdx;

  const step = simState.steps[stepIdx];
  const total = simState.steps.length - 1;
  const pos = window.__diagramPos;

  // Update button states
  document.getElementById('animPrevBtn').disabled = (stepIdx <= 0);
  document.getElementById('animNextBtn').disabled = (stepIdx >= total);

  // Update tape cell highlighting
  document.querySelectorAll('.tape-cell').forEach((cell, i) => {
    cell.classList.remove('active', 'consumed');
    if (stepIdx === 0) {
      // At step 0, no symbol consumed yet
    } else {
      const consumedIdx = stepIdx - 1;
      if (i < consumedIdx) cell.classList.add('consumed');
      else if (i === consumedIdx) cell.classList.add('active');
    }
  });

  // Reset visual active classes in SVG
  document.querySelectorAll('.edge-path').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.edge-flow').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.node-circle').forEach(el => el.classList.remove('active', 'accept-glow', 'reject-glow'));
  document.querySelectorAll('.derivation .step').forEach(el => el.classList.remove('active'));

  // Highlight current derivation step
  document.querySelectorAll(`.derivation .step[data-step="${stepIdx}"]`).forEach(el => el.classList.add('active'));

  const activeRing = document.getElementById('active-ring');
  const token = document.getElementById('sim-token');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');

  if (stepIdx === 0) {
    // Initial start state
    const curPos = pos[step.state];
    if (curPos && activeRing && token) {
      activeRing.setAttribute('cx', curPos.x);
      activeRing.setAttribute('cy', curPos.y);
      activeRing.style.display = 'block';

      token.setAttribute('cx', curPos.x);
      token.setAttribute('cy', curPos.y);
      token.setAttribute('fill', 'var(--accent)');
      token.style.display = 'block';
    }

    const nodeEl = document.getElementById(`node-circle-${step.state}`);
    if (nodeEl) nodeEl.classList.add('active');

    if (total === 0) {
      checkFinalStepVerdict(step, 0, 0);
    } else {
      statusText.textContent = `Start at state ${step.state}`;
      statusDot.className = 'status-dot running';
      soundEngine.playStep(0);
    }
    return;
  }

  // Step > 0 (Transition)
  const from = step.from;
  const to = step.to;
  const sym = step.sym;

  if (step.valid && to) {
    soundEngine.playStep(stepIdx);
    const edgePath = document.getElementById(`edge-path-${from}-${to}`);
    const edgeFlow = document.getElementById(`edge-flow-${from}-${to}`);
    if (edgePath) edgePath.classList.add('active');
    if (edgeFlow) edgeFlow.classList.add('active');

    const toPos = pos[to];

    if (animateMove && edgePath) {
      glideToken(edgePath, Math.min(simState.speed * 0.7, 500), () => {
        if (activeRing && toPos) {
          activeRing.setAttribute('cx', toPos.x);
          activeRing.setAttribute('cy', toPos.y);
          activeRing.style.display = 'block';
        }
        const nodeEl = document.getElementById(`node-circle-${to}`);
        if (nodeEl) nodeEl.classList.add('active');
        checkFinalStepVerdict(step, stepIdx, total);
      });
    } else {
      if (token && toPos) {
        token.setAttribute('cx', toPos.x);
        token.setAttribute('cy', toPos.y);
        token.style.display = 'block';
      }
      if (activeRing && toPos) {
        activeRing.setAttribute('cx', toPos.x);
        activeRing.setAttribute('cy', toPos.y);
        activeRing.style.display = 'block';
      }
      const nodeEl = document.getElementById(`node-circle-${to}`);
      if (nodeEl) nodeEl.classList.add('active');
      checkFinalStepVerdict(step, stepIdx, total);
    }

    statusText.textContent = `Step ${stepIdx}/${total}: ${from} ──[${sym}]──▶ ${to}`;
    statusDot.className = 'status-dot running';
  } else {
    // Invalid transition
    soundEngine.playReject();
    statusText.textContent = `Stuck: No transition from ${from} on '${sym}'`;
    statusDot.className = 'status-dot rejected';
    const nodeEl = document.getElementById(`node-circle-${from}`);
    if (nodeEl) nodeEl.classList.add('reject-glow');
    if (token) token.setAttribute('fill', 'var(--danger)');
  }
}

/**
 * Checks and displays final verdict glows when reaching the end of the input string.
 */
function checkFinalStepVerdict(step, stepIdx, total) {
  if (stepIdx === total) {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const token = document.getElementById('sim-token');
    const nodeEl = document.getElementById(`node-circle-${step.state}`);

    if (step.accepted) {
      soundEngine.playAccept();
      statusText.textContent = `✔ Accepted! Ended in accepting state ${step.state}`;
      statusDot.className = 'status-dot accepted';
      if (nodeEl) nodeEl.classList.add('accept-glow');
      if (token) token.setAttribute('fill', 'var(--accent2)');
    } else {
      soundEngine.playReject();
      statusText.textContent = `✖ Rejected! Ended in non-accepting state ${step.state}`;
      statusDot.className = 'status-dot rejected';
      if (nodeEl) nodeEl.classList.add('reject-glow');
      if (token) token.setAttribute('fill', 'var(--danger)');
    }
  }
}

/**
 * Smoothly animates the moving token along an SVG path.
 */
function glideToken(pathEl, duration, onComplete) {
  if (simState.tokenAnimId) {
    cancelAnimationFrame(simState.tokenAnimId);
  }
  const token = document.getElementById('sim-token');
  if (!token || !pathEl) {
    if (onComplete) onComplete();
    return;
  }

  token.style.display = 'block';
  const totalLen = pathEl.getTotalLength();
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    // Smooth ease-in-out quadratic
    const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
    const pt = pathEl.getPointAtLength(ease * totalLen);
    token.setAttribute('cx', pt.x);
    token.setAttribute('cy', pt.y);

    if (progress < 1) {
      simState.tokenAnimId = requestAnimationFrame(frame);
    } else {
      simState.tokenAnimId = null;
      if (onComplete) onComplete();
    }
  }
  simState.tokenAnimId = requestAnimationFrame(frame);
}

/**
 * Starts or toggles auto-play simulation of the test string.
 */
function playSimulation() {
  if (simState.isPlaying) {
    pauseSimulation();
    return;
  }
  if (!simState.steps || simState.steps.length === 0) return;

  if (simState.currentStep >= simState.steps.length - 1) {
    goToStep(0, false);
  }

  simState.isPlaying = true;
  document.getElementById('animPlayBtn').textContent = '⏸ Pause';
  document.getElementById('statusDot').className = 'status-dot running';

  function stepLoop() {
    if (!simState.isPlaying) return;
    if (simState.currentStep < simState.steps.length - 1) {
      goToStep(simState.currentStep + 1, true);
      simState.timer = setTimeout(stepLoop, simState.speed);
    } else {
      pauseSimulation();
    }
  }

  simState.timer = setTimeout(stepLoop, simState.speed * 0.35);
}

/**
 * Pauses auto-step playback.
 */
function pauseSimulation() {
  simState.isPlaying = false;
  if (simState.timer) clearTimeout(simState.timer);
  const playBtn = document.getElementById('animPlayBtn');
  if (playBtn) playBtn.textContent = '▶ Play';
}

/**
 * Advances by one step.
 */
function stepNext() {
  pauseSimulation();
  if (simState.currentStep < simState.steps.length - 1) {
    goToStep(simState.currentStep + 1, true);
  }
}

/**
 * Steps back by one step.
 */
function stepPrev() {
  pauseSimulation();
  if (simState.currentStep > 0) {
    goToStep(simState.currentStep - 1, false);
  }
}

/**
 * Resets animation to step 0.
 */
function resetSimulation() {
  pauseSimulation();
  goToStep(0, false);
}

// Attach event listeners
document.getElementById('buildBtn').addEventListener('click', buildTable);
document.getElementById('generateBtn').addEventListener('click', generate);

document.getElementById('testBtn').addEventListener('click', () => runTest(false));
document.getElementById('animateBtn').addEventListener('click', () => runTest(true));

document.getElementById('testString').addEventListener('keydown', e => {
  if (e.key === 'Enter') runTest(false);
});

// Animation control listeners
document.getElementById('animPlayBtn').addEventListener('click', playSimulation);
document.getElementById('animNextBtn').addEventListener('click', stepNext);
document.getElementById('animPrevBtn').addEventListener('click', stepPrev);
document.getElementById('animResetBtn').addEventListener('click', resetSimulation);

document.getElementById('animSpeed').addEventListener('change', e => {
  simState.speed = parseInt(e.target.value, 10) || 800;
});

/**
 * Interactive Particle & Automata Network Background
 * Generates floating state nodes, binary symbols, and filaments
 * that react smoothly to mouse movement, clicks, and theme changes.
 */
function initInteractiveBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;
  let particles = [];
  let ripples = [];
  const mouse = { x: -1000, y: -1000, active: false, radius: 180 };

  const stateLabels = ['q₀', 'q₁', 'q₂', 'q₃', 'S', 'A', 'B'];
  const glyphs = ['0', '1', 'δ', 'q', 'ε', 'Σ', 'λ', '→'];

  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    createParticles();
  }

  function createParticles() {
    const count = Math.max(35, Math.min(70, Math.floor((width * height) / 22000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let type = 'dot';
      let radius = Math.random() * 2.5 + 2; // Core dots: 2px - 4.5px
      let glyph = null;
      let fontSize = 14;
      let isFinal = false;

      if (rand < 0.24) {
        // Floating Automata State node
        type = 'state';
        radius = Math.random() * 4 + 10; // 10px - 14px circle radius
        glyph = stateLabels[Math.floor(Math.random() * stateLabels.length)];
        fontSize = 10;
        isFinal = Math.random() < 0.35;
      } else if (rand < 0.52) {
        // Mathematical & automata glyph
        type = 'glyph';
        glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
        fontSize = Math.floor(Math.random() * 6 + 13); // 13px - 18px font
        radius = fontSize * 0.55;
      }

      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.40,
        vy: (Math.random() - 0.5) * 0.40,
        radius,
        type,
        glyph,
        fontSize,
        isFinal,
        alpha: Math.random() * 0.35 + 0.25,
        baseAlpha: Math.random() * 0.35 + 0.25
      });
    }
  }

  function getPalette() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (theme === 'light') {
      return {
        dot: 'rgba(13, 148, 136, 0.45)',
        dotHalo: 'rgba(13, 148, 136, 0.12)',
        stateRing: 'rgba(13, 148, 136, 0.55)',
        stateFill: 'rgba(13, 148, 136, 0.08)',
        glyph: 'rgba(51, 65, 85, 0.42)',
        line: 'rgba(71, 85, 105, 0.10)',
        mouseLine: 'rgba(13, 148, 136, 0.32)',
        ripple: 'rgba(217, 119, 6, 0.42)'
      };
    } else if (theme === 'midnight') {
      return {
        dot: 'rgba(88, 166, 255, 0.55)',
        dotHalo: 'rgba(88, 166, 255, 0.15)',
        stateRing: 'rgba(88, 166, 255, 0.65)',
        stateFill: 'rgba(88, 166, 255, 0.10)',
        glyph: 'rgba(160, 185, 215, 0.45)',
        line: 'rgba(88, 166, 255, 0.12)',
        mouseLine: 'rgba(88, 166, 255, 0.35)',
        ripple: 'rgba(240, 136, 62, 0.42)'
      };
    } else {
      // Dark cyber (default)
      return {
        dot: 'rgba(111, 214, 200, 0.55)',
        dotHalo: 'rgba(111, 214, 200, 0.15)',
        stateRing: 'rgba(111, 214, 200, 0.65)',
        stateFill: 'rgba(111, 214, 200, 0.10)',
        glyph: 'rgba(165, 185, 215, 0.45)',
        line: 'rgba(111, 214, 200, 0.12)',
        mouseLine: 'rgba(227, 168, 87, 0.35)',
        ripple: 'rgba(227, 168, 87, 0.42)'
      };
    }
  }

  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
    mouse.x = -1000;
    mouse.y = -1000;
  });

  window.addEventListener('click', e => {
    soundEngine.playRipple();
    ripples.push({
      x: e.clientX,
      y: e.clientY,
      r: 0,
      maxR: 150,
      alpha: 0.60
    });
  });

  window.addEventListener('touchmove', e => {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });

  let isPaused = false;
  document.addEventListener('visibilitychange', () => {
    isPaused = document.hidden;
  });

  function render() {
    if (!isPaused) {
      ctx.clearRect(0, 0, width, height);
      const pal = getPalette();

      // Update and draw ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += 2.6;
        rip.alpha *= 0.95;
        if (rip.alpha < 0.01 || rip.r > rip.maxR) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = pal.ripple.replace(/[\d.]+\)$/, `${rip.alpha})`);
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Push nearby particles gently
        particles.forEach(p => {
          const dx = p.x - rip.x;
          const dy = p.y - rip.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0 && Math.abs(dist - rip.r) < 25) {
            const push = 0.6 * (1 - dist / rip.maxR);
            p.x += (dx / dist) * push;
            p.y += (dy / dist) * push;
          }
        });
      }

      // Update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Screen wrap with soft padding adjusted for larger particle radius
        if (p.x < -35) p.x = width + 35;
        else if (p.x > width + 35) p.x = -35;
        if (p.y < -35) p.y = height + 35;
        else if (p.y > height + 35) p.y = -35;

        // Mouse interaction (gentle attraction / hover filament)
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const proximity = 1 - dist / mouse.radius;
            // Draw filament to cursor
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = pal.mouseLine.replace(/[\d.]+\)$/, `${proximity * 0.40})`);
            ctx.lineWidth = 1.6 * proximity;
            ctx.stroke();

            // Subtle deflection force
            const force = (1 - dist / mouse.radius) * 0.35;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }
        }

        // Draw particle based on type
        if (p.type === 'state') {
          // Automata state circle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = pal.stateFill.replace(/[\d.]+\)$/, `${p.alpha * 0.4})`);
          ctx.fill();
          ctx.strokeStyle = pal.stateRing.replace(/[\d.]+\)$/, `${p.alpha})`);
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Double ring for accepting state
          if (p.isFinal) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(4, p.radius - 4.5), 0, Math.PI * 2);
            ctx.strokeStyle = pal.stateRing.replace(/[\d.]+\)$/, `${p.alpha * 0.9})`);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          // State label inside
          ctx.font = `600 ${p.fontSize}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = pal.glyph.replace(/[\d.]+\)$/, `${Math.min(1, p.alpha * 1.3)})`);
          ctx.fillText(p.glyph, p.x, p.y);
        } else if (p.type === 'glyph') {
          // Large mathematical / automata symbol
          ctx.font = `600 ${p.fontSize}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = pal.glyph.replace(/[\d.]+\)$/, `${p.alpha})`);
          ctx.fillText(p.glyph, p.x, p.y);
        } else {
          // Dot node with soft outer halo
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = pal.dotHalo.replace(/[\d.]+\)$/, `${p.alpha * 0.35})`);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = pal.dot.replace(/[\d.]+\)$/, `${p.alpha})`);
          ctx.fill();
        }

        // Connect adjacent particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140;
          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * 0.19;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = pal.line.replace(/[\d.]+\)$/, `${lineAlpha})`);
            ctx.lineWidth = 1.0;
            ctx.stroke();
          }
        }
      }
    }
    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);
}

/**
 * Automata & Grammar History Manager
 * Dual-persistence engine:
 * 1. Python + SQLite Backend (/api/history, history.db)
 * 2. Client-side LocalStorage fallback with full ANSI SQL export (.sql)
 */
const historyManager = {
  items: [],
  backend: 'checking',
  apiEndpoint: '/api/history',
  modalEl: null,
  listEl: null,
  searchInput: null,
  badgeEl: null,
  indicatorEl: null,
  indicatorText: null,
  lastSnapshotHash: null,
  toastTimeout: null,

  init() {
    this.modalEl = document.getElementById('historyModal');
    this.listEl = document.getElementById('historyList');
    this.searchInput = document.getElementById('historySearchInput');
    this.badgeEl = document.getElementById('historyBadge');
    this.indicatorEl = document.getElementById('historyBackendIndicator');
    this.indicatorText = document.getElementById('historyBackendText');

    // Load cached local records for instantaneous display
    this.loadFromStorage();
    this.updateUI();

    // Attach UI event listeners
    const toggleBtn = document.getElementById('historyToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleModal());
    }

    const closeBtn = document.getElementById('historyCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) this.closeModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalEl && this.modalEl.classList.contains('open')) {
        this.closeModal();
      }
    });

    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.renderList());
    }

    const exportBtn = document.getElementById('historyExportSqlBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportSql());
    }

    const syncBtn = document.getElementById('historySyncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.syncToSqlite());
    }

    const clearBtn = document.getElementById('historyClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }

    // Probe SQLite Backend
    this.checkBackend();
  },

  async checkBackend() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(this.apiEndpoint, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'ok') {
          this.backend = 'sqlite';
          if (this.indicatorEl) this.indicatorEl.className = 'history-status-indicator online';
          if (this.indicatorText) this.indicatorText.textContent = '🟢 SQLite Connected (history.db)';
          const backendVal = document.getElementById('histStatBackend');
          if (backendVal) backendVal.textContent = 'SQLite3 (history.db)';

          if (Array.isArray(data.history) && data.history.length > 0) {
            this.items = data.history;
            this.saveToStorage();
          } else if (this.items.length > 0) {
            this.syncToSqlite(true);
          }
          this.updateUI();
          return;
        }
      }
    } catch (e) {
      // Backend not running on same origin or offline
    }

    this.backend = 'localStorage';
    if (this.indicatorEl) this.indicatorEl.className = 'history-status-indicator local';
    if (this.indicatorText) this.indicatorText.textContent = '🔵 Local Storage (Run python server.py for SQLite)';
    const backendVal = document.getElementById('histStatBackend');
    if (backendVal) backendVal.textContent = 'Local (Offline)';
    this.updateUI();
  },

  loadFromStorage() {
    try {
      const raw = localStorage.getItem('toc_dfa_history');
      if (raw) {
        this.items = JSON.parse(raw);
      }
    } catch (e) {
      this.items = [];
    }
  },

  saveToStorage() {
    try {
      localStorage.setItem('toc_dfa_history', JSON.stringify(this.items.slice(0, 100)));
    } catch (e) {}
  },

  async recordSnapshot(triggerSource = 'generate', verdictText = '') {
    try {
      const trans = (typeof readTransitions === 'function') ? readTransitions() : (window.__lastTrans || {});
      const str = (document.getElementById('testString') ? document.getElementById('testString').value : '') || '';
      const verdict = verdictText || (document.getElementById('verdict') ? document.getElementById('verdict').textContent : '');

      let title = 'Custom DFA';
      const presetSelect = document.getElementById('presetSelect');
      if (presetSelect && presetSelect.selectedOptions && presetSelect.selectedOptions[0]) {
        title = presetSelect.selectedOptions[0].text;
      }
      if (!title || title.includes('Custom')) {
        title = `DFA (${cfg.n} states, |Σ|=${cfg.alphabet.length})`;
      }

      // Hash to prevent rapid consecutive duplicate saves
      const hash = `${cfg.n}-${cfg.alphabet.join(',')}-${cfg.start}-${[...cfg.finals].join(',')}-${JSON.stringify(trans)}-${str}-${verdict}`;
      if (this.lastSnapshotHash === hash) return;
      this.lastSnapshotHash = hash;

      const item = {
        id: Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        title,
        num_states: cfg.n,
        alphabet: [...cfg.alphabet],
        start_state: cfg.start,
        final_states: Array.from(cfg.finals),
        transitions: trans,
        sample_string: str,
        verdict: verdict,
        notes: `Recorded via ${triggerSource}`
      };

      this.items.unshift(item);
      if (this.items.length > 100) this.items.pop();
      this.saveToStorage();
      this.updateUI();

      if (this.backend === 'sqlite') {
        fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        }).then(res => res.json()).then(data => {
          if (data && data.id) {
            item.id = data.id;
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[History] Snapshot record warning:', e);
    }
  },

  toggleModal() {
    if (!this.modalEl) return;
    const isOpen = this.modalEl.classList.contains('open');
    if (isOpen) {
      this.closeModal();
    } else {
      this.openModal();
    }
  },

  openModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('open');
    this.modalEl.setAttribute('aria-hidden', 'false');
    this.checkBackend();
    this.renderList();
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 100);
    }
  },

  closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    this.modalEl.setAttribute('aria-hidden', 'true');
  },

  updateUI() {
    const total = this.items.length;
    if (this.badgeEl) {
      this.badgeEl.textContent = total;
      this.badgeEl.style.display = total > 0 ? 'inline-block' : 'none';
    }

    const totalEl = document.getElementById('histStatTotal');
    if (totalEl) totalEl.textContent = total;

    let accepted = 0;
    let rejected = 0;
    this.items.forEach(it => {
      const v = String(it.verdict || '');
      if (v.includes('Accepted')) accepted++;
      else if (v.includes('Rejected')) rejected++;
    });

    const accEl = document.getElementById('histStatAccept');
    if (accEl) accEl.textContent = accepted;

    const rejEl = document.getElementById('histStatReject');
    if (rejEl) rejEl.textContent = rejected;

    if (this.modalEl && this.modalEl.classList.contains('open')) {
      this.renderList();
    }
  },

  renderList() {
    if (!this.listEl) return;

    const query = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
    let filtered = this.items;

    if (query) {
      filtered = this.items.filter(it => {
        const title = (it.title || '').toLowerCase();
        const str = (it.sample_string || '').toLowerCase();
        const verdict = (it.verdict || '').toLowerCase();
        const states = Array.isArray(it.alphabet) ? it.alphabet.join('') : String(it.alphabet || '');
        return title.includes(query) || str.includes(query) || verdict.includes(query) || states.includes(query);
      });
    }

    if (filtered.length === 0) {
      this.listEl.innerHTML = `
        <div class="history-empty-state">
          <div class="history-empty-icon">📜</div>
          <p class="history-empty-title">${query ? 'No matching records found' : 'No history records yet'}</p>
          <p class="history-empty-desc">${query ? 'Try modifying your search filter.' : 'Generate a grammar or run a test string to save history records automatically in SQLite or Local Storage.'}</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach((it, index) => {
      const finalsList = Array.isArray(it.final_states) ? it.final_states.join(', ') : (it.final_states || 'none');
      const alphaList = Array.isArray(it.alphabet) ? it.alphabet.join(',') : (it.alphabet || '0,1');
      const isAccept = String(it.verdict || '').includes('Accepted');
      const isReject = String(it.verdict || '').includes('Rejected');

      let verdictPill = '';
      if (it.sample_string !== undefined && it.sample_string !== '') {
        let badgeCls = isAccept ? 'accept' : (isReject ? 'reject' : '');
        let badgeTxt = isAccept ? '✔ Accepted' : (isReject ? '✖ Rejected' : 'Evaluated');
        verdictPill = `
          <div class="history-test-row">
            <span class="hist-str">Input String: <code>${escapeHtml(it.sample_string)}</code></span>
            <span class="hist-verdict-badge ${badgeCls}">${badgeTxt}</span>
          </div>
        `;
      }

      html += `
        <div class="history-card" data-id="${it.id || index}">
          <div class="history-card-top">
            <h4 class="history-card-title">
              <span>⚙️</span> ${escapeHtml(it.title || 'DFA Configuration')}
            </h4>
            <span class="history-card-time">${escapeHtml(it.timestamp || '')}</span>
          </div>

          <div class="history-tags">
            <span class="hist-tag">States: <strong>${it.num_states}</strong></span>
            <span class="hist-tag tag-accent2">Σ = {${escapeHtml(alphaList)}}</span>
            <span class="hist-tag tag-accent">Start: <strong>${escapeHtml(it.start_state || 'q0')}</strong></span>
            <span class="hist-tag">Finals: <strong>{${escapeHtml(finalsList)}}</strong></span>
          </div>

          ${verdictPill}

          <div class="history-card-actions">
            <button type="button" class="hist-action-load" onclick="historyManager.restoreById(${it.id || index})" title="Restore this DFA configuration and run grammars">
              <span>▶</span> Restore to Engine
            </button>
            <button type="button" class="hist-action-sub" onclick="historyManager.copySqlById(${it.id || index}, this)" title="Copy SQL INSERT query for this record">
              <span>📋</span> Copy SQL
            </button>
            <button type="button" class="hist-action-sub hist-action-delete" onclick="historyManager.deleteById(${it.id || index})" title="Delete record">
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>
      `;
    });

    this.listEl.innerHTML = html;
  },

  restoreById(id) {
    const item = this.items.find(it => it.id === id || String(it.id) === String(id)) || this.items[id];
    if (!item) return;

    try {
      const numStatesEl = document.getElementById('numStates');
      const alphabetEl = document.getElementById('alphabet');
      const testStringEl = document.getElementById('testString');

      cfg.n = parseInt(item.num_states, 10) || 3;
      if (numStatesEl) numStatesEl.value = cfg.n;

      const alpha = Array.isArray(item.alphabet) ? item.alphabet : String(item.alphabet).split(',').map(s => s.trim());
      cfg.alphabet = [...alpha];
      if (alphabetEl) alphabetEl.value = alpha.join(',');

      cfg.start = item.start_state || 'q0';

      const finals = Array.isArray(item.final_states) ? item.final_states : String(item.final_states || '').split(',').map(s => s.trim());
      cfg.finals = new Set(finals.filter(Boolean));

      window.__lastTrans = JSON.parse(JSON.stringify(item.transitions || {}));

      buildTable();
      generate();

      if (item.sample_string !== undefined && item.sample_string !== '' && testStringEl) {
        testStringEl.value = item.sample_string;
        runTest(false);
      }

      this.closeModal();
      this.showToast(`✔ Restored: ${item.title || 'DFA Configuration'}`);

      try {
        if (typeof soundEngine !== 'undefined' && soundEngine.enabled) {
          soundEngine.playTransition();
        }
      } catch (e) {}
    } catch (err) {
      console.error('[History] Restore error:', err);
      this.showToast('Failed to restore history configuration.');
    }
  },

  copySqlById(id, btnEl) {
    const item = this.items.find(it => it.id === id || String(it.id) === String(id)) || this.items[id];
    if (!item) return;

    const sql = this.generateInsertSql(item);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(sql).then(() => {
        if (btnEl) {
          const orig = btnEl.innerHTML;
          btnEl.innerHTML = '<span>✔</span> Copied!';
          btnEl.style.color = '#10B981';
          setTimeout(() => {
            btnEl.innerHTML = orig;
            btnEl.style.color = '';
          }, 1500);
        }
        this.showToast('SQL INSERT copied to clipboard');
      }).catch(() => {
        this.showToast('Failed to copy to clipboard');
      });
    } else {
      prompt('Copy SQL INSERT statement:', sql);
    }
  },

  generateInsertSql(item) {
    const esc = (val) => {
      if (val === null || val === undefined) return 'NULL';
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const alphaStr = Array.isArray(item.alphabet) ? JSON.stringify(item.alphabet) : String(item.alphabet);
    const finalsStr = Array.isArray(item.final_states) ? JSON.stringify(item.final_states) : String(item.final_states);
    const transStr = (typeof item.transitions === 'object') ? JSON.stringify(item.transitions) : String(item.transitions || '{}');

    return `INSERT INTO dfa_history (timestamp, title, num_states, alphabet, start_state, final_states, transitions_json, sample_string, verdict, notes) VALUES (${esc(item.timestamp)}, ${esc(item.title)}, ${item.num_states}, ${esc(alphaStr)}, ${esc(item.start_state)}, ${esc(finalsStr)}, ${esc(transStr)}, ${esc(item.sample_string || '')}, ${esc(item.verdict || '')}, ${esc(item.notes || '')});`;
  },

  deleteById(id) {
    const idx = this.items.findIndex(it => it.id === id || String(it.id) === String(id));
    if (idx !== -1) {
      this.items.splice(idx, 1);
      this.saveToStorage();
      this.updateUI();

      if (this.backend === 'sqlite') {
        fetch(`/api/history/${id}`, { method: 'DELETE' }).catch(() => {});
      }
      this.showToast('History record deleted.');
    }
  },

  clearAll() {
    if (this.items.length === 0) return;
    if (!confirm('Are you sure you want to clear all history records?')) return;

    this.items = [];
    this.saveToStorage();
    this.updateUI();

    if (this.backend === 'sqlite') {
      fetch('/api/history', { method: 'DELETE' }).catch(() => {});
    }
    this.showToast('All history records cleared.');
  },

  exportSql() {
    if (this.items.length === 0) {
      this.showToast('No history records to export.');
      return;
    }

    if (this.backend === 'sqlite') {
      window.location.href = '/api/history/export.sql';
      this.showToast('Downloading SQL dump from SQLite database...');
      return;
    }

    const lines = [
      '-- ============================================================',
      '-- FA → Regular Grammar Engine · SQL History Dump',
      `-- Exported on: ${new Date().toISOString()}`,
      '-- ============================================================',
      '',
      'CREATE TABLE IF NOT EXISTS dfa_history (',
      '    id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '    timestamp TEXT NOT NULL,',
      '    title TEXT,',
      '    num_states INTEGER NOT NULL,',
      '    alphabet TEXT NOT NULL,',
      '    start_state TEXT NOT NULL,',
      '    final_states TEXT NOT NULL,',
      '    transitions_json TEXT NOT NULL,',
      '    sample_string TEXT,',
      '    verdict TEXT,',
      '    notes TEXT',
      ');',
      ''
    ];

    this.items.forEach(it => {
      lines.push(this.generateInsertSql(it));
    });

    const blob = new Blob([lines.join('\n')], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dfa_history_dump_${new Date().toISOString().substring(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('✔ Exported ANSI SQL dump file!');
  },

  async syncToSqlite(silent = false) {
    if (this.items.length === 0) {
      if (!silent) this.showToast('No local records to sync.');
      return;
    }

    try {
      const res = await fetch('/api/history/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.items)
      });
      if (res.ok) {
        const data = await res.json();
        this.backend = 'sqlite';
        if (this.indicatorEl) this.indicatorEl.className = 'history-status-indicator online';
        if (this.indicatorText) this.indicatorText.textContent = '🟢 SQLite Connected (history.db)';
        if (!silent) this.showToast(`✔ Synced ${data.inserted || this.items.length} records to SQLite database!`);
      } else {
        if (!silent) this.showToast('Sync failed: Python SQLite server not responding.');
      }
    } catch (e) {
      if (!silent) this.showToast('Could not reach SQLite server. Start server with: python server.py');
    }
  },

  showToast(msg) {
    const toast = document.getElementById('historyToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
};

window.historyManager = historyManager;

// Classic Theoretical DFA Presets
const PRESETS = {
  ends_01: {
    name: 'Ends with "01"',
    n: 3,
    alphabet: ['0', '1'],
    start: 'q0',
    finals: ['q2'],
    trans: {
      q0: { '0': 'q1', '1': 'q0' },
      q1: { '0': 'q1', '1': 'q2' },
      q2: { '0': 'q1', '1': 'q0' }
    },
    sampleString: '1101'
  },
  even_0: {
    name: 'Even number of 0s',
    n: 2,
    alphabet: ['0', '1'],
    start: 'q0',
    finals: ['q0'],
    trans: {
      q0: { '0': 'q1', '1': 'q0' },
      q1: { '0': 'q0', '1': 'q1' }
    },
    sampleString: '10101'
  },
  contains_101: {
    name: 'Contains substring "101"',
    n: 4,
    alphabet: ['0', '1'],
    start: 'q0',
    finals: ['q3'],
    trans: {
      q0: { '0': 'q0', '1': 'q1' },
      q1: { '0': 'q2', '1': 'q1' },
      q2: { '0': 'q0', '1': 'q3' },
      q3: { '0': 'q3', '1': 'q3' }
    },
    sampleString: '001010'
  },
  div_3: {
    name: 'Binary number divisible by 3',
    n: 3,
    alphabet: ['0', '1'],
    start: 'q0',
    finals: ['q0'],
    trans: {
      q0: { '0': 'q0', '1': 'q1' },
      q1: { '0': 'q2', '1': 'q0' },
      q2: { '0': 'q1', '1': 'q2' }
    },
    sampleString: '110'
  },
  alternating: {
    name: 'Alternating 0s and 1s',
    n: 4,
    alphabet: ['0', '1'],
    start: 'q0',
    finals: ['q0', 'q1', 'q2'],
    trans: {
      q0: { '0': 'q1', '1': 'q2' },
      q1: { '0': 'q3', '1': 'q2' },
      q2: { '0': 'q1', '1': 'q3' },
      q3: { '0': 'q3', '1': 'q3' }
    },
    sampleString: '0101'
  }
};

/**
 * Loads a classic DFA preset and regenerates the table, grammars, and diagram.
 */
function loadPreset(presetKey) {
  const p = PRESETS[presetKey];
  if (!p) return;

  document.getElementById('numStates').value = p.n;
  document.getElementById('alphabet').value = p.alphabet.join(',');
  document.getElementById('testString').value = p.sampleString;

  cfg.n = p.n;
  cfg.alphabet = [...p.alphabet];
  cfg.start = p.start;
  cfg.finals = new Set(p.finals);
  window.__lastTrans = JSON.parse(JSON.stringify(p.trans));

  buildTable();
  generate();
}

const presetSelect = document.getElementById('presetSelect');
if (presetSelect) {
  presetSelect.addEventListener('change', e => {
    if (e.target.value) {
      loadPreset(e.target.value);
    }
  });
}

// Bootstrap app, theme, sound, interactive background, history, and initial preset
soundEngine.init();
initTheme();
initInteractiveBackground();
historyManager.init();
loadPreset('ends_01');
siteLoader.initEvents();

