import { useEffect, useRef } from "react";

/**
 * The living colour field behind the night screens (design: Naz Paşalı — her
 * original shader). One light ramp from midnight through plum, burgundy and
 * burnt red to amber, gathering around the compass. Drawn at reduced
 * resolution and ~45 fps, paused when the tab is hidden or the field is off
 * screen, and drawn once (still) under prefers-reduced-motion. Without WebGL
 * nothing is drawn and the CSS night field shows instead.
 */
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime, uEnergy, uPull; uniform vec2 uFocus;
const vec3 MID = vec3(0.040, 0.045, 0.120);
const vec3 PLUM = vec3(0.170, 0.060, 0.200);
const vec3 BURG = vec3(0.380, 0.050, 0.130);
const vec3 BURNT = vec3(0.740, 0.200, 0.090);
const vec3 AMB = vec3(0.960, 0.620, 0.240);
const vec3 IVO = vec3(0.980, 0.920, 0.820);
const vec3 VIO = vec3(0.300, 0.260, 0.560);
const vec3 ICE = vec3(0.550, 0.740, 1.000);
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0) * 5.0;
  if (x < 1.0) return mix(MID, PLUM, smoothstep(0.0, 1.0, x));
  if (x < 2.0) return mix(PLUM, BURG, smoothstep(0.0, 1.0, x - 1.0));
  if (x < 3.0) return mix(BURG, BURNT, smoothstep(0.0, 1.0, x - 2.0));
  if (x < 4.0) return mix(BURNT, AMB, smoothstep(0.0, 1.0, x - 3.0));
  return mix(AMB, IVO, smoothstep(0.0, 1.0, x - 4.0));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 f = (uFocus - 0.5 * uRes) / uRes.y;
  float t = uTime;
  vec2 d = p - f; float r = length(d);
  float a = uPull * 1.4 * exp(-r * 2.3) + 0.3 * uEnergy * exp(-r * 1.1);
  float ca = cos(a), sa = sin(a);
  d = mat2(ca, -sa, sa, ca) * d;
  d *= 1.0 + uPull * 0.4 * exp(-r * 2.0);
  p = f + d;
  vec2 q = vec2(fbm(p * 0.9 + vec2(0.0, 0.10 * t)), fbm(p * 0.9 + vec2(5.2, 1.3) - 0.08 * t));
  vec2 s = vec2(fbm(p * 0.9 + 3.0 * q + vec2(1.7, 9.2) + 0.06 * t), fbm(p * 0.9 + 3.0 * q + vec2(8.3, 2.8) - 0.05 * t));
  float n = fbm(p * 0.85 + 3.2 * s);
  float lum = smoothstep(0.26, 0.78, n + 0.45 * (s.x - 0.5));
  float well = exp(-r * r * 2.6);
  lum = lum * (0.5 + 0.5 * smoothstep(1.0, 0.35, uv.y)) + well * (0.2 + 0.32 * uPull) + 0.06 * uEnergy;
  lum = clamp(pow(lum, 1.25), 0.0, 1.0);
  vec3 col = ramp(lum * 0.97);
  float cool = smoothstep(0.52, 0.78, q.y) * (1.0 - smoothstep(0.22, 0.6, lum));
  col = mix(col, VIO, cool * 0.6);
  col += ICE * smoothstep(0.74, 0.92, s.y) * (1.0 - lum) * 0.10;
  float band = sin(n * 72.0 + s.x * 14.0 - t * 0.9);
  col += IVO * smoothstep(0.93, 1.0, band) * 0.05 * (0.35 + lum) * (0.6 + 0.4 * uEnergy);
  col += AMB * well * 0.08 * uPull;
  float vig = smoothstep(1.25, 0.35, length((uv - vec2(0.5, 0.5)) * vec2(1.0, 1.2)));
  col *= 0.6 + 0.4 * vig;
  gl_FragColor = vec4(col, 1.0);
}`;

const MODES = {
  home: { energy: 0.35, pull: 0.55 },
  seek: { energy: 1.0, pull: 1.0 },
  lock: { energy: 0.55, pull: 0.8 },
  bingo: { energy: 0.22, pull: 0.0 },
} as const;

export type LivingMode = keyof typeof MODES;

export function LivingCanvas({
  mode = "home",
  focusSelector = ".night-dial",
}: {
  mode?: LivingMode;
  /** The element the light gathers around (the compass), relative to the field. */
  focusSelector?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<LivingMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const field = cv.parentElement;
    if (!field) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = cv.getContext("webgl", {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });
    } catch {
      gl = null;
    }
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const o = gl!.createShader(type)!;
      gl!.shaderSource(o, src);
      gl!.compileShader(o);
      if (!gl!.getShaderParameter(o, gl!.COMPILE_STATUS)) throw new Error("shader");
      return o;
    };
    let U: Record<string, WebGLUniformLocation | null> = {};
    try {
      const pr = gl.createProgram()!;
      gl.attachShader(
        pr,
        sh(gl.VERTEX_SHADER, "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }"),
      );
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error("link");
      gl.useProgram(pr);
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "a");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      U = Object.fromEntries(
        ["uRes", "uTime", "uEnergy", "uPull", "uFocus"].map((n) => [
          n,
          gl!.getUniformLocation(pr, n),
        ]),
      );
    } catch {
      return;
    }
    cv.dataset.on = "1";

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const SCALE = 0.55;
    const cur = { ...MODES[modeRef.current] };
    let T = 37,
      raf = 0,
      last = 0,
      acc = 0,
      visible = true;

    const resize = () => {
      const w = Math.max(2, Math.round(field.clientWidth * SCALE));
      const h = Math.max(2, Math.round(field.clientHeight * SCALE));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl!.viewport(0, 0, w, h);
      }
    };
    const focus = (): [number, number] => {
      const el = field.querySelector(focusSelector) as HTMLElement | null;
      if (!el) return [cv.width / 2, cv.height * 0.55];
      const fr = field.getBoundingClientRect(),
        r = el.getBoundingClientRect();
      return [
        (r.left - fr.left + r.width / 2) * SCALE,
        cv.height - (r.top - fr.top + r.height / 2) * SCALE,
      ];
    };
    const draw = () => {
      gl!.uniform2f(U.uRes, cv.width, cv.height);
      gl!.uniform1f(U.uTime, T);
      gl!.uniform1f(U.uEnergy, cur.energy);
      gl!.uniform1f(U.uPull, cur.pull);
      const f = focus();
      gl!.uniform2f(U.uFocus, f[0], f[1]);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.06, (now - last) / 1000) : 0.016;
      last = now;
      acc += dt;
      if (acc < 1 / 45) return;
      const step = acc;
      acc = 0;
      const tgt = MODES[modeRef.current];
      const k = 1 - Math.exp(-step * 1.8);
      cur.energy += (tgt.energy - cur.energy) * k;
      cur.pull += (tgt.pull - cur.pull) * k;
      T += step * (0.32 + 0.95 * cur.energy);
      draw();
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw();
    });
    ro.observe(field);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(field);
    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      delete cv.dataset.on;
    };
    cv.addEventListener("webglcontextlost", lost);
    if (reduce) draw();
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      cv.removeEventListener("webglcontextlost", lost);
      delete cv.dataset.on;
    };
  }, [focusSelector]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="living-canvas pointer-events-none absolute inset-0 -z-[1] h-full w-full opacity-0 transition-opacity duration-700 data-[on]:opacity-100"
    />
  );
}
