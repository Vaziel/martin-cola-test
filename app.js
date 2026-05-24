/* =========================================================================
   КОЛА ОТ МАРТИНА — interactions + GSAP scroll animations
   ========================================================================= */
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth anchor scrolling ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const top = (id === '#top') ? 0 : el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Header colour inversion on dark sections ---------- */
  (() => {
    const header = document.getElementById('header');
    const sections = document.querySelectorAll('[data-theme]');
    if (!header || !sections.length) return;
    const setHeaderTheme = () => {
      const probeY = header.offsetHeight / 2 + 4;
      let current = null;
      sections.forEach(s => {
        const r = s.getBoundingClientRect();
        if (r.top <= probeY && r.bottom > probeY) current = s;
      });
      if (current) header.classList.toggle('is-light', current.dataset.theme === 'light');
    };
    setHeaderTheme();
    window.addEventListener('scroll', setHeaderTheme, { passive: true });
    window.addEventListener('resize', setHeaderTheme);
  })();

  /* ---------- Process progress tracking ---------- */
  (() => {
    const progress = document.getElementById('processProgress');
    const steps = document.querySelectorAll('.process__step');
    if (!progress || !steps.length) return;
    const items = progress.querySelectorAll('.process__progress-item');
    const tick = () => {
      let bestIdx = -1, bestDist = Infinity;
      const mid = window.innerHeight * 0.5;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const center = r.top + r.height / 2;
        if (r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15) {
          const d = Math.abs(center - mid);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
      });
      if (bestIdx >= 0) items.forEach((it, i) => it.classList.toggle('is-active', i === bestIdx));
    };
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  })();

  /* ---------- Forms: AJAX submit to send.php ---------- */
  document.querySelectorAll('form.form').forEach(form => {
    // Если у формы нет action (главная страница пока без send.php) — оставляем fallback visual feedback
    if (!form.action || form.action.endsWith('#')) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('.btn');
      const consent = form.querySelector('input[name="consent"]');
      if (consent && !consent.checked) {
        consent.focus();
        return;
      }

      // Удалим предыдущие сообщения
      form.querySelectorAll('.form-success, .form-error').forEach(el => el.remove());

      const originalLabel = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Отправка…';
      }

      try {
        const formData = new FormData(form);
        const res = await fetch(form.action, {
          method: 'POST',
          body: formData,
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        });
        let data = {};
        try { data = await res.json(); } catch (_) { /* not json */ }

        if (res.ok && data.ok) {
          form.classList.add('form--sent');
          const success = document.createElement('div');
          success.className = 'form-success';
          success.setAttribute('role', 'status');
          success.setAttribute('aria-live', 'polite');
          success.innerHTML = '<strong>Заявка получена ✓</strong>' +
            (data.message ? '<span>' + data.message + '</span>' : 'Менеджер свяжется в&nbsp;течение рабочего дня.');
          form.appendChild(success);
          form.reset();
        } else {
          throw new Error(data.message || 'Ошибка отправки');
        }
      } catch (err) {
        const error = document.createElement('div');
        error.className = 'form-error';
        error.setAttribute('role', 'alert');
        error.textContent = err.message || 'Ошибка сети. Напишите на profopt2013@mail.ru';
        form.appendChild(error);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalLabel;
        }
      }
    });
  });

  /* ---------- Counter 240 ---------- */
  (() => {
    const counter = document.getElementById('counter240');
    if (!counter) return;
    const target = parseInt(counter.dataset.target, 10) || 240;
    const sup = '<sup>м</sup>';
    let done = false;
    const run = () => {
      if (done) return; done = true;
      if (reduceMotion) { counter.innerHTML = target + sup; return; }
      const dur = 1900, t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        counter.innerHTML = v + sup;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    new IntersectionObserver(
      (es) => es.forEach(e => { if (e.isIntersecting) run(); }),
      { threshold: 0.5 }
    ).observe(counter);
  })();

  /* ---------- Well diagram draw-in ---------- */
  (() => {
    const well = document.getElementById('wellDiagram');
    if (!well) return;
    new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) well.classList.add('is-in');
    }), { threshold: 0.3 }).observe(well);
  })();

  /* =========================================================================
     SCROLL ANIMATIONS
     ========================================================================= */
  const allReveal = document.querySelectorAll('.reveal, .reveal-img');

  // No GSAP or reduced motion → everything visible, no motion.
  if (!hasGSAP || reduceMotion) {
    allReveal.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    const heritageFlat = document.querySelector('.heritage');
    if (heritageFlat) heritageFlat.classList.add('heritage--flat');
    return;
  }

  /* ---------- HERO intro timeline ---------- */
  try {
  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  heroTl
    .from('.bottle', { opacity: 0, scale: 0.9, duration: 1.5, ease: 'power2.out' }, 0)
    .from('.hero__head .l', { yPercent: 110, opacity: 0, duration: 1.05, stagger: 0.12 }, 0.25)
    .from('.hero__sub', { y: 26, opacity: 0, duration: .8 }, 0.7)
    .from('.hero__meta .row', { y: 18, opacity: 0, duration: .6, stagger: 0.1 }, 0.8)
    .from('.hero__corner-tr', { y: 20, opacity: 0, duration: 1 }, 0.6)
    .from('.hero__medal', { opacity: 0, scale: 0.7, rotate: -8, duration: 1.2, ease: 'back.out(1.4)' }, 0.9)
    .from('.hero__medal-cap', { opacity: 0, y: 12, duration: .7 }, 1.3)
    .from('.hero__scrollcue', { opacity: 0, duration: .6 }, 1.1);

  /* ---------- Reveal on scroll ---------- */
  const inGroup = (el) => el.closest(
    '.formats__grid, .tasting__quotes, .press__quotes, .partners__grid, .logistics'
  );

  gsap.utils.toArray('.reveal').forEach(el => {
    if (inGroup(el)) return; // staggered separately below
    gsap.from(el, {
      y: 72, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  gsap.utils.toArray('.reveal-img').forEach(el => {
    gsap.from(el, {
      y: 60, opacity: 0, scale: 1.06, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%' }
    });
  });

  /* ---------- Staggered card groups ---------- */
  [['.formats__grid', '.format-card'],
   ['.press__quotes', '.press__quote'],
   ['.partners__grid', '.track'],
   ['.logistics', '.logistics__item']].forEach(([wrapSel, itemSel]) => {
    const wrap = document.querySelector(wrapSel);
    if (!wrap) return;
    gsap.from(wrap.querySelectorAll(itemSel), {
      y: 64, opacity: 0, duration: .9, ease: 'power3.out', stagger: 0.14,
      scrollTrigger: { trigger: wrap, start: 'top 82%' }
    });
  });

  /* ---------- Parallax ---------- */
  // Hero content lifts & fades as the section leaves
  gsap.to('.hero__copy', {
    y: -90, opacity: 0.25, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
  gsap.to('.hero__corner-tr', {
    y: 140, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });

  /* ---------- HERITAGE pinned stepper ---------- */
  const heritage = document.querySelector('.heritage');
  const hpin = document.querySelector('.heritage__pin');
  const hsteps = gsap.utils.toArray('.hstep');
  if (heritage && hpin && hsteps.length > 1) {
    const n = hsteps.length;
    const hpCur = document.querySelector('.hp-cur');
    const hpFill = document.querySelector('.hp-fill');
    gsap.set(hsteps, { opacity: 0 });
    gsap.set(hsteps[0], { opacity: 1 });

    const htl = gsap.timeline({
      scrollTrigger: {
        trigger: heritage,
        start: 'top top',
        end: '+=' + (n * 90) + '%',
        pin: hpin,
        scrub: 1,
        snap: { snapTo: 1 / (n - 1), duration: { min: 0.15, max: 0.5 }, ease: 'power1.inOut' },
        onUpdate: (self) => {
          const idx = Math.min(n - 1, Math.round(self.progress * (n - 1)));
          if (hpCur) hpCur.textContent = String(idx + 1).padStart(2, '0');
          if (hpFill) hpFill.style.width = ((idx + 1) / n * 100) + '%';
        }
      }
    });

    hsteps.forEach((step, i) => {
      if (i === 0) return;
      const prev = hsteps[i - 1];
      const lbl = 'h' + i;
      htl.addLabel(lbl)
        // фон-слой: быстрый кроссфейд, чтобы цифра не висела в полупрозрачности
        .to(prev, { opacity: 0, duration: 0.55, ease: 'power2.in' }, lbl)
        .fromTo(step, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power2.out' }, lbl)
        // цифры — одометр: старая уезжает вверх за маску, новая въезжает снизу, без наложения
        .to(prev.querySelector('.hstep__num-i'), { yPercent: -125, duration: 1, ease: 'power3.inOut' }, lbl)
        .fromTo(step.querySelector('.hstep__num-i'), { yPercent: 125 }, { yPercent: 0, duration: 1, ease: 'power3.inOut' }, lbl)
        .fromTo(step.querySelector('.hstep__txt'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, lbl + '+=0.15');
    });
  }

  // Section headings drift slightly
  gsap.utils.toArray('.h-section').forEach(el => {
    gsap.fromTo(el, { y: 34 }, {
      y: -34, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  });

  /* ---------- 3D bottle reacts to scroll ---------- */
  const mv = document.querySelector('model-viewer');
  if (mv) {
    const orbit = { deg: 12 };
    gsap.to(orbit, {
      deg: 220, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
      onUpdate: () => { mv.cameraOrbit = `${orbit.deg}deg 86deg 100%`; }
    });
    gsap.to('.bottle', {
      yPercent: 16, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    /* ---------- Hover-wobble на бутылке (через bbox-проверку) ---------- */
    const bottle = document.querySelector('.bottle');
    const heroSec = document.querySelector('.hero');
    if (bottle && heroSec && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let isWobbling = false;
      let wasInside = false;
      const triggerWobble = () => {
        if (isWobbling) return;
        isWobbling = true;
        gsap.to(bottle, {
          keyframes: [
            { rotation:  2.4, duration: 0.14, ease: 'power2.out' },
            { rotation: -1.8, duration: 0.18, ease: 'power1.inOut' },
            { rotation:  1.2, duration: 0.18, ease: 'power1.inOut' },
            { rotation: -0.6, duration: 0.18, ease: 'power1.inOut' },
            { rotation:  0,   duration: 0.24, ease: 'power2.out' }
          ],
          transformOrigin: '50% 95%',
          onComplete: () => { isWobbling = false; }
        });
      };
      heroSec.addEventListener('mousemove', (e) => {
        const r = bottle.getBoundingClientRect();
        // суженный hit-box по центру (60% ширины, 70% высоты) — реальный силуэт бутылки
        const padX = r.width * 0.20;
        const padY = r.height * 0.15;
        const inside =
          e.clientX > r.left + padX &&
          e.clientX < r.right - padX &&
          e.clientY > r.top + padY &&
          e.clientY < r.bottom - padY;
        if (inside && !wasInside) triggerWobble();
        wasInside = inside;
      });
      heroSec.addEventListener('mouseleave', () => { wasInside = false; });
    }
  }

  /* ---------- WELL: путь воды — капля поднимается и наполняет бутылку ---------- */
  const wellDrop = document.querySelector('#wellDrop');
  const wellRise = document.getElementById('wellRiseRect');
  const wellLabel = document.querySelector('#wellLabel');
  if (wellDrop && wellRise) {
    const wtl = gsap.timeline({
      scrollTrigger: { trigger: '.well__grid', start: 'top 62%', end: 'bottom bottom', scrub: 1 }
    });
    wtl
      .fromTo(wellDrop, { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.5, transformOrigin: '0px 0px' }, 0)
      .to(wellDrop, { y: 58, duration: 3.4, ease: 'none' }, 0.5)
      .to(wellDrop, { y: -120, duration: 1, ease: 'power1.in' }, '>')
      .to(wellDrop, { opacity: 0, scale: 0.3, duration: 0.4 }, '>-0.45')
      .fromTo(wellRise, { attr: { y: 22, height: 0 } },
        { attr: { y: -170, height: 196 }, duration: 3, ease: 'none' }, 3.6)
      .fromTo(wellLabel, { opacity: 0 }, { opacity: 1, duration: 0.9 }, '>-0.9')
      .to({}, { duration: 4.5 });   // хвост: бутылка с этикеткой «КОЛА» стоит — успеть рассмотреть
  }

  /* ---------- PROCESS: SVG animations ---------- */

  // 01 Извлечение — капли поднимаются по трубе, резервуар наполняется
  const proc1 = document.querySelector('#proc-svg-1');
  if (proc1) {
    const drops = proc1.querySelectorAll('#proc1-drops circle');
    const tankFill = proc1.querySelector('#proc1-tank-fill');
    const flow = proc1.querySelector('#proc1-flow');

    // Циклический поток-дашоффсет (фон, идёт всегда)
    gsap.to(flow, { strokeDashoffset: -120, duration: 2.4, repeat: -1, ease: 'none' });

    // Капли поднимаются с задержкой stagger
    drops.forEach((d, i) => {
      gsap.fromTo(d,
        { attr: { cy: 266 }, opacity: 0 },
        {
          attr: { cy: 48 },
          opacity: 1,
          duration: 1.8,
          ease: 'none',
          repeat: -1,
          delay: i * 0.36,
          repeatDelay: 1.2,
          onUpdate: function() {
            // плавно гасим у вершины
            const cy = parseFloat(d.getAttribute('cy'));
            if (cy < 80) d.setAttribute('opacity', String((cy - 48) / 32 * 0.9));
            else d.setAttribute('opacity', '0.9');
          }
        }
      );
    });

    // Резервуар наполняется по скроллу (clipPath rect высота)
    gsap.fromTo(tankFill,
      { attr: { y: 68, height: 0 } },
      {
        attr: { y: 14, height: 54 },
        ease: 'none',
        scrollTrigger: {
          trigger: '.process__step[data-step="1"]',
          start: 'top 80%',
          end: 'bottom 40%',
          scrub: 1
        }
      }
    );
  }

  // 02 Фильтрация — частицы идут к фильтру, гаснут на мембране, чистый поток на выходе
  const proc2 = document.querySelector('#proc-svg-2');
  if (proc2) {
    const particles = proc2.querySelectorAll('#proc2-particles circle');
    const flowIn = proc2.querySelector('#proc2-flow-in');
    const flowOut = proc2.querySelector('#proc2-flow-out');

    // Циклические потоки-дашоффсеты
    gsap.to(flowIn, { strokeDashoffset: 140, duration: 3.2, repeat: -1, ease: 'none' });
    gsap.to(flowOut, { strokeDashoffset: -140, duration: 2.4, repeat: -1, ease: 'none' });

    // Частицы движутся слева к корпусу и исчезают на мембране (x=140)
    particles.forEach((p, i) => {
      gsap.fromTo(p,
        { attr: { cx: 0 }, opacity: 0 },
        {
          attr: { cx: 140 },
          opacity: 0.9,
          duration: 2.2,
          ease: 'none',
          repeat: -1,
          delay: i * 0.4,
          repeatDelay: 0.6,
          onUpdate: function() {
            const cx = parseFloat(p.getAttribute('cx'));
            // gentle vertical jitter via cy
            p.setAttribute('cy', String(140 + Math.sin(cx / 7) * 8));
            // вход — fade in 0→30, плато 30→120, fade out 120→140 (на мембране)
            if (cx < 30) p.setAttribute('opacity', String(cx / 30 * 0.9));
            else if (cx > 120) p.setAttribute('opacity', String((140 - cx) / 20 * 0.9));
            else p.setAttribute('opacity', '0.9');
          }
        }
      );
    });
  }

  // 03 Купаж и CO₂ — потоки сливаются, сатуратор наполняется, пузыри
  const proc3 = document.querySelector('#proc-svg-3');
  if (proc3) {
    const syrupFlow = proc3.querySelector('#proc3-flow-syrup');
    const waterFlow = proc3.querySelector('#proc3-flow-water');
    const mixFlow = proc3.querySelector('#proc3-flow-mix');
    const co2Flow = proc3.querySelector('#proc3-co2-flow');
    const satFill = proc3.querySelector('#proc3-sat-fill');
    const bubbles = proc3.querySelectorAll('#proc3-bubbles circle');

    gsap.to(syrupFlow, { strokeDashoffset: -160, duration: 2.8, repeat: -1, ease: 'none' });
    gsap.to(waterFlow, { strokeDashoffset: -160, duration: 3.0, repeat: -1, ease: 'none' });
    gsap.to(mixFlow, { strokeDashoffset: -160, duration: 2.2, repeat: -1, ease: 'none' });
    gsap.to(co2Flow, { strokeDashoffset: -200, duration: 2.6, repeat: -1, ease: 'none' });

    // Сатуратор наполняется по скроллу
    gsap.fromTo(satFill,
      { attr: { y: 320, height: 0 } },
      {
        attr: { y: 30, height: 290 },
        ease: 'none',
        scrollTrigger: {
          trigger: '.process__step[data-step="3"]',
          start: 'top 80%',
          end: 'bottom 40%',
          scrub: 1
        }
      }
    );

    // Пузыри поднимаются циклически
    bubbles.forEach((b, i) => {
      gsap.fromTo(b,
        { attr: { cy: 310 }, opacity: 0 },
        {
          attr: { cy: 30 },
          duration: 3.2 + (i % 3) * 0.4,
          ease: 'sine.inOut',
          repeat: -1,
          delay: i * 0.42,
          onUpdate: function() {
            const cy = parseFloat(b.getAttribute('cy'));
            // fade in/out на краях
            if (cy > 290) b.setAttribute('opacity', String((310 - cy) / 20 * 0.85));
            else if (cy < 50) b.setAttribute('opacity', String((cy - 30) / 20 * 0.85));
            else b.setAttribute('opacity', '0.85');
          }
        }
      );
    });
  }

  // 04 Розлив — конвейер, бутылки едут, под краном наполняются + крышка
  const proc4 = document.querySelector('#proc-svg-4');
  if (proc4) {
    const tapFlow = proc4.querySelector('#proc4-tap-flow');
    const pour = proc4.querySelector('#proc4-pour');
    const bottles = proc4.querySelectorAll('.proc4-bottle');
    const fills = proc4.querySelectorAll('.proc4-fill');
    const caps = proc4.querySelectorAll('.proc4-cap');

    // Поток в трубке между танком и краном (всегда)
    gsap.to(tapFlow, { strokeDashoffset: -60, duration: 1.6, repeat: -1, ease: 'none' });

    // Бесконечный конвейер: каждая бутылка едет от -30 до 410 за cycleDuration
    // Шаг = (410 - (-30)) / 4 = 110 px между бутылками
    // Отрицательный delay сдвигает старт каждой → wrap'ы происходят асинхронно
    const cycleDuration = 6;
    const stepDelay = cycleDuration / bottles.length; // 1.5s между бутылками
    const fillPos = 200;
    const fillWindow = 40;
    const capDelay = 8;

    // Pour-индикатор: показывается когда любая бутылка в окне 170..210
    const updatePour = () => {
      let anyInWindow = false;
      bottles.forEach(bot => {
        const cur = gsap.getProperty(bot, 'x');
        if (cur > 170 && cur < 210) anyInWindow = true;
      });
      gsap.to(pour, { opacity: anyInWindow ? 0.85 : 0, duration: 0.2, overwrite: true });
    };

    bottles.forEach((bot, i) => {
      const fill = fills[i];
      const cap = caps[i];
      gsap.fromTo(bot,
        { x: -30 },
        {
          x: 410,
          duration: cycleDuration,
          ease: 'none',
          repeat: -1,
          delay: -i * stepDelay, // отрицательный delay → стартовые позиции сдвинуты
          onRepeat: () => {
            // Сброс на новый цикл
            cap.setAttribute('opacity', '0');
            fill.setAttribute('y', '-2');
            fill.setAttribute('height', '0');
          },
          onUpdate: function() {
            const cur = gsap.getProperty(bot, 'x');
            if (cur < fillPos - fillWindow) {
              fill.setAttribute('y', '-2');
              fill.setAttribute('height', '0');
            } else if (cur < fillPos) {
              const amount = (cur - (fillPos - fillWindow)) / fillWindow;
              const h = amount * 32;
              fill.setAttribute('y', String(-2 - h));
              fill.setAttribute('height', String(h));
            } else {
              fill.setAttribute('y', '-34');
              fill.setAttribute('height', '32');
            }
            if (cur > fillPos + capDelay) {
              cap.setAttribute('opacity', '0.92');
            } else {
              cap.setAttribute('opacity', '0');
            }
            updatePour();
          }
        }
      );
    });
  }

  /* ---------- FORMATS: ПЭТ tab-switcher ---------- */
  const petCard = document.querySelector('#pet-card');
  if (petCard) {
    const data = JSON.parse(petCard.getAttribute('data-vols'));
    const tabs = petCard.querySelectorAll('.format-tab');
    const photos = petCard.querySelectorAll('.pet-photo');
    const volEl = petCard.querySelector('#pet-vol');
    const tagEl = petCard.querySelector('#pet-tagline');
    const packEl = petCard.querySelector('#pet-pack');
    const palletEl = petCard.querySelector('#pet-pallet');
    const chanEl = petCard.querySelector('#pet-channel');

    const setVol = (key) => {
      const v = data[key];
      if (!v) return;
      // Переключение фото через is-active (CSS делает crossfade)
      photos.forEach(p => {
        p.classList.toggle('is-active', p.getAttribute('data-vol') === key);
      });
      // Кросс-фейд текстов
      petCard.classList.add('is-swapping');
      setTimeout(() => {
        volEl.innerHTML = v.label + '<span>л</span>';
        tagEl.textContent = v.tagline;
        packEl.textContent = v.pack;
        if (palletEl) palletEl.textContent = v.pallet || '';
        chanEl.textContent = v.channel;
        petCard.classList.remove('is-swapping');
      }, 230);
      // Активный таб
      tabs.forEach(t => {
        const active = t.getAttribute('data-vol') === key;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => setVol(tab.getAttribute('data-vol')));
    });

    setVol('2');
  }

  /* ---------- Recalculate triggers once fonts & 3D settle ---------- */
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  if (mv) mv.addEventListener('load', () => setTimeout(refresh, 100));
  } catch (e) { console.error('app.js animation error:', e); }

})();
