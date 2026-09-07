import { Controller } from '@hotwired/stimulus';

interface Line {
    angle:           number;
    baseAngle:       number;
    length:          number;
    normalizedLength: number; // 0–1 relative to max radius, used for intro stagger
    lengthOffset:    number;  // stretch when fleeing mouse
    offset:          number;
    phase:           number;
    speed:           number;
    dotPhase:        number;
    dotSpeed:        number;
    needlePhase:     number;
    needleSpeed:     number;
}

type RGB = readonly [number, number, number];

interface LengthLayer {
    min:   number;
    max:   number;
    count: number;
}

/** Design tokens — mirror tailwind.css @theme variables */
const C: Record<string, RGB> = {
    violet:      [139, 92,  246], // --color-violet-500
    indigo:      [79,  70,  229], // --color-indigo-600
    purpleDark:  [147, 51,  234], // --color-purple-600
    amber:       [251, 191, 36],  // --color-amber-400
    orangeLight: [251, 146, 60],  // --color-orange-400
    pink:        [236, 72,  153], // --color-pink-500
    surface:     [249, 250, 251], // ≈ --color-surface
    white:       [255, 255, 255],
};

const rgba = ([r, g, b]: RGB, a: number): string =>
    `rgba(${r},${g},${b},${+a.toFixed(3)})`;

// Ease out cubic — fast start, smooth deceleration
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export default class DandelionController extends Controller {
    static values = { mode: { type: String, default: 'light' } };
    declare modeValue: string;
    private _canvas!:  HTMLCanvasElement;
    private _ctx!:     CanvasRenderingContext2D;
    private _lines:    Line[] = [];
    private _center  = { x: 0, y: 0 };
    private _rafId   = 0;
    private _mouse   = { x: 0, y: 0, isActive: false };
    private _time    = 0;
    private _visible = false;
    private _cachedRect = { width: 0, height: 0 };
    private _effectiveDark = false;
    private _themeObserver!: MutationObserver;

    // Intro grow animation
    private _introPlayed    = false; // fires only once
    private _introProgress  = -1;   // -1 = not started (needles hidden), 0→1 = growing
    private _introStartTime = -1;   // performance.now() timestamp when intro begins
    private _isMobile       = false;

    private _headingObserver!:    IntersectionObserver;
    private _statObserver!:       IntersectionObserver;
    private _visibilityObserver!: IntersectionObserver;
    private _introObserver!:      IntersectionObserver;

    // Arrow functions preserve `this` across event listeners
    private _onMouseMove = (e: MouseEvent): void => {
        const r = this._canvas.getBoundingClientRect();
        this._mouse = { x: e.clientX - r.left, y: e.clientY - r.top, isActive: true };
    };

    private _onMouseLeave = (): void => {
        this._mouse.isActive = false;
    };

    private _onResize = (): void => {
        cancelAnimationFrame(this._rafId);
        this._setup();
        if (this._visible) this._animate();
    };

    connect(): void {
        // Cache effective dark state once, then watch for html[data-user-theme] changes
        const html = document.documentElement;
        const resolveTheme = (): boolean =>
            (html.dataset.userTheme ?? this.modeValue) === 'dark';
        this._effectiveDark = resolveTheme();

        this._themeObserver = new MutationObserver(() => {
            this._effectiveDark = resolveTheme();
        });
        this._themeObserver.observe(html, { attributes: true, attributeFilter: ['data-user-theme'] });

        this._setupObservers();

        const canvas = this.element.querySelector<HTMLCanvasElement>('#dandelion-canvas');
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        this._canvas = canvas;
        this._ctx    = ctx;

        this._canvas.addEventListener('mousemove',  this._onMouseMove);
        this._canvas.addEventListener('mouseleave', this._onMouseLeave);
        window.addEventListener('resize', this._onResize);

        // Double rAF: Safari reads getBoundingClientRect() before layout is settled on first load,
        // resulting in wrong canvas dimensions and a blurry render.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            this._setup();

            // Re-run after fonts load: Google Fonts swap can change container height,
            // invalidating the canvas pixel dimensions (causing blur).
            void document.fonts.ready.then(() => {
                const rect = this._canvas.getBoundingClientRect();
                if (
                    Math.abs(rect.width  - this._cachedRect.width)  > 1 ||
                    Math.abs(rect.height - this._cachedRect.height) > 1
                ) {
                    cancelAnimationFrame(this._rafId);
                    this._setup();
                    if (this._visible) this._animate();
                }
            });
        }));
        // Animation starts only once the section enters the viewport (via _visibilityObserver)
    }

    disconnect(): void {
        cancelAnimationFrame(this._rafId);
        this._canvas?.removeEventListener('mousemove',  this._onMouseMove);
        this._canvas?.removeEventListener('mouseleave', this._onMouseLeave);
        window.removeEventListener('resize', this._onResize);
        this._themeObserver?.disconnect();
        this._headingObserver?.disconnect();
        this._statObserver?.disconnect();
        this._visibilityObserver?.disconnect();
        this._introObserver?.disconnect();
    }

    // ── Observers ────────────────────────────────────────────────────

    private _setupObservers(): void {
        // Pause/resume RAF based on section visibility
        // Pause/resume RAF based on whole section visibility
        this._visibilityObserver = new IntersectionObserver(entries => {
            entries.forEach(e => {
                this._visible = e.isIntersecting;
                if (this._visible) {
                    this._animate();
                } else {
                    cancelAnimationFrame(this._rafId);
                }
            });
        }, { rootMargin: '0px' });
        // Double rAF: Safari fires the initial IO callback before layout is fully computed,
        // reporting isIntersecting: false for a canvas that IS in the viewport, so the RAF
        // never starts and the canvas stays blank on first load.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (this._canvas) this._visibilityObserver.observe(this._canvas);
        }));

        // Trigger intro grow when the canvas bottom enters the viewport.
        // threshold: 0.5 = fires when half the canvas is visible (bottom half = dandelion root area).
        // Additional 300ms delay lets the user settle before the animation kicks off.
        this._introObserver = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting || this._introPlayed) return;
                this._introPlayed = true;
                setTimeout(() => {
                    this._introStartTime = performance.now();
                    this._introProgress = 0;
                }, 300); // 300ms delay then needles grow
                this._introObserver.disconnect();
            });
        }, { rootMargin: '0px', threshold: 0.5 });
        // Double rAF: same Safari first-load IO timing fix as _visibilityObserver above
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (this._canvas) this._introObserver.observe(this._canvas);
        }));

        const headingEl = this.element.querySelector<HTMLElement>('.gc-heading');
        if (headingEl) {
            this._headingObserver = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('in-view');
                    this._headingObserver.unobserve(e.target);
                });
            }, { rootMargin: '0px' });
            this._headingObserver.observe(headingEl);
        }

        const stats = Array.from(this.element.querySelectorAll<HTMLElement>('.gc-stat'));
        this._statObserver = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const delay = Number((e.target as HTMLElement).dataset.statDelay) || 0;
                setTimeout(() => e.target.classList.add('in-view'), delay);
                this._statObserver.unobserve(e.target);
            });
        }, { rootMargin: '0px' });
        stats.forEach(s => this._statObserver.observe(s));
    }

    // ── Canvas setup ─────────────────────────────────────────────────

    private _setup(): void {
        const dpr  = window.devicePixelRatio || 1;
        const rect = this._canvas.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            setTimeout(() => this._setup(), 50);
            return;
        }

        this._canvas.width  = rect.width  * dpr;
        this._canvas.height = rect.height * dpr;
        this._ctx.setTransform(1, 0, 0, 1, 0, 0);
        this._ctx.scale(dpr, dpr);

        // Cache rect dimensions — only updated on resize, not every frame
        this._cachedRect = { width: rect.width, height: rect.height };

        const isMobile = rect.width < 768;
        this._isMobile = isMobile;
        const targetRadius = Math.min(rect.height * (isMobile ? 0.61 : 0.855), isMobile ? 291 : 505);
        const lineCount = isMobile ? 130 : 200;
        const layerScale = targetRadius / 505;
        const sideAccentBoost = 50 * layerScale;
        const innerCount = Math.max(2, Math.round(lineCount * 0.02));
        const outerCount = Math.max(4, Math.round(lineCount * 0.03));
        const remainingCount = Math.max(0, lineCount - innerCount - outerCount);
        const middleRanges = [
            { min: 50 * layerScale,  max: 130 * layerScale },
            { min: 130 * layerScale, max: 210 * layerScale },
            { min: 210 * layerScale, max: 290 * layerScale },
            { min: 290 * layerScale, max: 370 * layerScale },
            { min: 370 * layerScale, max: 460 * layerScale },
        ];
        const totalMiddleWeight = middleRanges.reduce(
            (sum, range) => sum + Math.pow(range.max * range.max - range.min * range.min, 0.69),
            0,
        );
        const weightedMiddleRanges = middleRanges.map((range, index) => {
            const annulusWeight = range.max * range.max - range.min * range.min;
            const weight = Math.pow(annulusWeight, 0.69);
            const exactCount = remainingCount * weight / totalMiddleWeight;

            return {
                index,
                ...range,
                count: Math.floor(exactCount),
                remainder: exactCount - Math.floor(exactCount),
            };
        });
        const assignedMiddleCount = weightedMiddleRanges.reduce((sum, range) => sum + range.count, 0);
        let leftoverMiddleCount = remainingCount - assignedMiddleCount;

        [...weightedMiddleRanges]
            .sort((a, b) => b.remainder - a.remainder)
            .forEach(range => {
                if (leftoverMiddleCount <= 0) return;
                weightedMiddleRanges[range.index].count += 1;
                leftoverMiddleCount -= 1;
            });

        const layers: LengthLayer[] = [
            { min: 30 * layerScale,  max: 70 * layerScale,  count: innerCount },
            ...weightedMiddleRanges.map(range => ({ min: range.min, max: range.max, count: range.count })),
            { min: 470 * layerScale, max: 505 * layerScale, count: outerCount },
        ];
        const lineLayers: LengthLayer[] = layers.flatMap(layer =>
            Array.from({ length: layer.count }, () => layer),
        );
        const distributedLayers: LengthLayer[] = Array.from({ length: lineCount });
        const layerStride = 47;

        lineLayers.forEach((layer, index) => {
            distributedLayers[(index * layerStride) % lineCount] = layer;
        });

        this._center = { x: rect.width * 0.5, y: rect.height };

        const maxPossibleLength = targetRadius * 1.08 + sideAccentBoost;

        this._lines = Array.from({ length: lineCount }, (_, i) => {
            const angle = Math.PI * ((i + 0.5) / lineCount);
            const layer = distributedLayers[i] ?? layers[3];
            const sideAngle = Math.min(angle, Math.PI - angle);
            const sideWeight = Math.max(0, 1 - sideAngle / ((2 * Math.PI) / 9));
            const ellipseFactor = 0.88 + sideWeight * 0.22;
            const spread = layer.min < 70 * layerScale
                ? Math.pow(Math.random(), 1.1)
                : layer.min >= 470 * layerScale
                    ? 0.72 + Math.pow(Math.random(), 0.85) * 0.28
                    : Math.random();
            const minLength = layer.min;
            const maxLength = layer.max;
            const edgeIndex = Math.min(i, lineCount - 1 - i);
            const isSideAccent = edgeIndex === 1 || edgeIndex === 4;
            const baseLength = (minLength + spread * (maxLength - minLength)) * ellipseFactor;
            const length = Math.min(
                baseLength + (isSideAccent ? sideAccentBoost : 0),
                maxPossibleLength,
            );
            const normalizedLength = Math.min(1, Math.max(0, length / maxPossibleLength));
            const twinkleSpeed = 1.22 - normalizedLength * 0.66;

            return {
                angle,
                baseAngle:        angle,
                length,
                normalizedLength,
                lengthOffset:     0,
                offset:           0,
                phase:           Math.random() * Math.PI * 2,
                speed:           0.52 + Math.random() * 0.48,
                dotPhase:        Math.random() * Math.PI * 2,
                dotSpeed:        twinkleSpeed + Math.random() * 0.08,
                needlePhase:     Math.random() * Math.PI * 2,
                needleSpeed:     twinkleSpeed,
            };
        });
    }

    // ── Render loop ──────────────────────────────────────────────────

    private _animate(): void {
        if (!this._visible) return;

        this._time += 0.01;

        // Advance intro using wall-clock time so speed is frame-rate independent
        const introActive = this._introProgress >= 0 && this._introProgress < 1;
        if (introActive) {
            this._introProgress = Math.min(1, (performance.now() - this._introStartTime) / 750);
        }

        const ctx    = this._ctx;
        const { width, height } = this._cachedRect; // use cached rect — no layout thrash
        const center = this._center;

        ctx.clearRect(0, 0, width, height);

        // ── Pass 1: draw all needle lines (no shadow) ─────────────────
        ctx.lineWidth = 1;
        ctx.lineCap   = 'round';

        for (const line of this._lines) {
            const sway = Math.sin(this._time * line.speed + line.phase) * 0.075;

            let mi = 0;
            let targetLengthOffset = 0;

            if (this._mouse.isActive) {
                const curLen = line.length + line.lengthOffset;
                const ex  = center.x + Math.cos(line.angle) * curLen;
                const ey  = center.y - Math.sin(line.angle) * curLen;
                const dx  = this._mouse.x - ex;
                const dy  = this._mouse.y - ey;
                const d   = Math.sqrt(dx * dx + dy * dy);

                if (d < 220) {
                    const proximity = 1 - d / 220;
                    const θ = line.angle;
                    const verticalInfluence = dy / Math.max(d, 1);
                    mi = (dx * Math.sin(θ) + dy * Math.cos(θ)) / Math.max(d, 1) * proximity * 0.35;
                    targetLengthOffset = Math.max(
                        -line.length * 0.38,
                        proximity * (verticalInfluence > 0 ? verticalInfluence * 130 : verticalInfluence * 90),
                    );
                }
            }

            line.offset       += (mi - line.offset) * 0.1;
            line.lengthOffset += (targetLengthOffset - line.lengthOffset) * 0.08;
            line.angle         = line.baseAngle + sway + line.offset;

            // Intro grow: shorter lines bloom first, longer ones trail slightly behind
            let introScale: number;
            if (this._introProgress < 0) {
                introScale = 0; // not started yet — needles hidden
            } else if (introActive) {
                // Each line starts growing after a small delay proportional to its length
                // delay range: 0 (shortest) → 0.25 (longest)
                const delay = line.normalizedLength * 0.25;
                const t = Math.max(0, (this._introProgress - delay) / (1 - delay));
                introScale = easeOutCubic(Math.min(1, t));
            } else {
                introScale = 1;
            }

            const drawLen = (line.length + line.lengthOffset) * introScale;
            const endX = center.x + Math.cos(line.angle) * drawLen;
            const endY = center.y - Math.sin(line.angle) * drawLen;
            if (endY > height || endY < -50) continue;

            // Fade lines near the top
            const fadeStart = height * 0.2;
            let fo = 1;
            if (endY < fadeStart) {
                const r = Math.max(0, endY / fadeStart);
                fo = Math.max(0.01, 0.01 + 0.99 * Math.pow(r, 2));
            }

            const no  = Math.abs(Math.sin(this._time * line.needleSpeed + line.needlePhase));
            const fin = fo * no;

            const dark = this._effectiveDark;
            const needle1 = dark ? C.white : C.violet;
            const needle2 = dark ? C.white : C.indigo;
            const g = ctx.createLinearGradient(center.x, center.y, endX, endY);
            g.addColorStop(0,    rgba(needle1, 0));
            g.addColorStop(0.28, rgba(needle1, 0));
            g.addColorStop(0.43, rgba(needle1, 0.18 * fin));
            g.addColorStop(0.55, rgba(needle1, 0.45 * fin));
            g.addColorStop(1,    rgba(needle2,  0.8 * fin));

            ctx.strokeStyle = g;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Store computed values for dot pass
            (line as Line & { _ex: number; _ey: number; _fin: number; _g: CanvasGradient })._ex  = endX;
            (line as Line & { _ex: number; _ey: number; _fin: number; _g: CanvasGradient })._ey  = endY;
            (line as Line & { _ex: number; _ey: number; _fin: number; _g: CanvasGradient })._fin = fin;
            (line as Line & { _ex: number; _ey: number; _fin: number; _g: CanvasGradient })._g   = g;
        }

        // ── Pass 2: draw all dots with shadow in one batch ────────────
        // Setting shadowBlur once per batch instead of per-line halves compositor overhead
        const isDarkMode = this._effectiveDark;
        ctx.shadowBlur  = this._isMobile ? 4 : 8;
        ctx.shadowColor = isDarkMode ? rgba(C.white, 0.35) : rgba(C.purpleDark, 0.4);

        for (const line of this._lines) {
            const l = line as Line & { _ex?: number; _ey?: number; _fin?: number; _g?: CanvasGradient };
            if (l._ex === undefined) continue;
            ctx.fillStyle = l._g!;
            ctx.globalAlpha = l._fin!;
            ctx.beginPath();
            ctx.arc(l._ex, l._ey, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;

        this._rafId = requestAnimationFrame(() => this._animate());
    }
}
