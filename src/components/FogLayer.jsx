import { useEffect, useRef } from 'react';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Domain-warped fractal noise: each layer of noise bends the next, so the fog curls and
// billows like smoke instead of sliding. Denser near the ground, thin towards the sky.
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uOpacity;
uniform vec3 uLight;
uniform vec3 uShade;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * 2.4;
  float t = uTime;

  // The pointer pushes the fog aside a little, like walking through smoke
  vec2 m = vec2(uMouse.x * aspect, uMouse.y) * 2.4;
  vec2 dm = p - m;
  float near = exp(-dot(dm, dm) * 1.6) * uMouseOn;
  p += normalize(dm + 1e-4) * near * 0.35;

  vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + t * vec2(0.050, 0.012)),
                fbm(p + vec2(5.2, 1.3) + t * vec2(-0.032, 0.020)));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * 0.041),
                fbm(p + 3.5 * q + vec2(8.3, 2.8) - t * 0.035));
  float f = fbm(p + 3.0 * r + vec2(t * 0.022, -t * 0.006));

  float d = smoothstep(0.32, 0.92, f);
  d *= 0.55 + 0.45 * clamp(length(q), 0.0, 1.0);
  d *= mix(1.0, 0.3, smoothstep(0.05, 0.95, uv.y));
  d *= 1.0 - near * 0.55;

  // Lit tops of the billows are warmer, the hollows are cool grey
  vec3 col = mix(uShade, uLight, clamp(f * f * 1.8 + r.x * 0.25, 0.0, 1.0));
  float a = clamp(d * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('[FogLayer]', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/**
 * Drifting, billowing fog drawn by a small WebGL shader behind the page. Renders at a fraction
 * of screen resolution (fog is soft anyway) and at about 30 fps; stays still for reduced motion.
 */
export default function FogLayer({ opacity = 0.6, light = '#c9b6a2', shade = '#5d5a60', scale = 0.4, speed = 1.5, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false });
    if (!gl) return undefined;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return undefined;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = Object.fromEntries(['uRes', 'uTime', 'uMouse', 'uMouseOn', 'uOpacity', 'uLight', 'uShade'].map((n) => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform1f(u.uOpacity, opacity);
    gl.uniform3fv(u.uLight, rgb(light));
    gl.uniform3fv(u.uShade, rgb(shade));

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(u.uRes, w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    // Pointer, eased so the fog follows it lazily
    const target = { x: 0.5, y: 0.5, on: 0 };
    const mouse = { x: 0.5, y: 0.5, on: 0 };
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = 1 - (e.clientY - r.top) / r.height;
      target.on = 1;
    };
    const onLeave = () => { target.on = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // Start somewhere in the middle of the pattern so the first frame already looks settled
    const t0 = performance.now() - 40000;
    const draw = (now) => {
      mouse.x += (target.x - mouse.x) * 0.06;
      mouse.y += (target.y - mouse.y) * 0.06;
      mouse.on += (target.on - mouse.on) * 0.04;
      gl.uniform1f(u.uTime, ((now - t0) / 1000) * speed);
      gl.uniform2f(u.uMouse, mouse.x, mouse.y);
      gl.uniform1f(u.uMouseOn, mouse.on);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 32) return;
      last = now;
      draw(now);
    };
    if (still) draw(performance.now());
    else raf = requestAnimationFrame(loop);

    const onLost = (e) => { e.preventDefault(); cancelAnimationFrame(raf); };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [opacity, light, shade, scale, speed]);

  return <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${className}`} aria-hidden="true" />;
}
