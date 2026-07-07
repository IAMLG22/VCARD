/**
 * MLG Studio — vCard digital (versión definitiva)
 * ------------------------------------------------
 * Path sugerido: /components/ui/mlg-vcard.tsx
 *
 * Setup local:
 *   npm install three lucide-react
 *   npm install -D @types/three
 *   (Tailwind ya configurado; no requiere shadcn)
 *
 * Uso (ej. /app/[user]/page.tsx):
 *
 *   import MLGVCard from "@/components/ui/mlg-vcard";
 *
 *   export default function Page() {
 *     return (
 *       <MLGVCard person="manuel" /> // "manuel" → Glassmorphism | "alvaro" → Asimétrico
 *     );
 *   }
 *
 * "Añadir Contacto" genera el .vcf en el cliente: en Android usa el share
 * sheet nativo (navigator.share con File) y en iOS/escritorio descarga el
 * archivo, que iOS abre directamente en la app de Contactos.
 */

"use client";

import { useEffect, useRef } from "react";
import { UserPlus, ArrowUpRight } from "lucide-react";
import * as THREE from "three";

/* ================================================================== */
/* Datos de perfil                                                     */
/* ================================================================== */

export type PersonKey = "manuel" | "alvaro";

const WEBSITE_URL = "https://mlgstudiolp.vercel.app/";
const ORG = "MLG Studio";
const ROLE = "CEO";
const CONTACT_EMAIL = "ia.hdt.malaga@gmail.com";

interface Profile {
  name: string;
  firstName: string;
  lastName: string;
  initials: string;
  title: string;
  phone: string;
}

const PROFILES: Record<PersonKey, Profile> = {
  manuel: {
    name: "Manuel Vega Cuadrado",
    firstName: "Manuel",
    lastName: "Vega Cuadrado",
    initials: "MV",
    title: "CEO MLG Studio",
    phone: "+34 647741386",
  },
  alvaro: {
    name: "Álvaro Rodríguez Samper",
    firstName: "Álvaro",
    lastName: "Rodríguez Samper",
    initials: "ÁR",
    title: "CEO MLG Studio",
    phone: "+34 693810183",
  },
};

/* ================================================================== */
/* vCard (.vcf) — generación y entrega según plataforma                */
/* ================================================================== */

/** String vCard 3.0. CRLF obligatorio por RFC 2426 (iOS lo exige). */
function buildVCardString(profile: Profile): string {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${profile.lastName};${profile.firstName};;;`,
    `FN:${profile.name}`,
    `ORG:${ORG}`,
    `TITLE:${ROLE}`,
    `TEL;TYPE=CELL:${profile.phone}`,
    `EMAIL;TYPE=INTERNET:${CONTACT_EMAIL}`,
    `URL:${WEBSITE_URL}`,
    "END:VCARD",
  ].join("\r\n");
}

/**
 * Entrega el .vcf al usuario:
 * - Android moderno: share sheet nativo (navigator.share con File),
 *   que permite guardarlo directo en Contactos sin pasar por Descargas.
 * - iOS: descarga vía <a> temporal; Safari intercepta el .vcf y abre
 *   la pantalla nativa de añadir contacto (el share sheet lo evitamos
 *   a propósito porque añade un paso innecesario).
 * - Escritorio: descarga vía <a> temporal.
 */
async function handleDownloadContact(profile: Profile): Promise<void> {
  const fileName =
    profile.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase() + ".vcf";

  const file = new File([buildVCardString(profile)], fileName, {
    type: "text/vcard",
  });

  // iPadOS moderno se identifica como "MacIntel" pero es táctil
  const isIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (!isIOS && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: profile.name });
      return;
    } catch (err) {
      // Usuario cerró el share sheet: no hacer nada más
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Cualquier otro fallo: continuar con la descarga tradicional
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleOpenWebsite(): void {
  window.open(WEBSITE_URL, "_blank", "noopener,noreferrer");
}

/* ================================================================== */
/* Fondo WebGL — campo de puntos 3D (Three.js vía npm, sin CDN)        */
/* ================================================================== */

function DotsBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.z = 2.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Nube de puntos con opacidad dinámica por profundidad (shader)
    const COUNT = 900;
    const positions = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * 1.6;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.6;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 1.6;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = clamp((2.8 + mv.z) / 2.8, 0.0, 1.0);
          float twinkle = 0.55 + 0.45 * sin(uTime * 2.2 + aPhase);
          vAlpha = depth * twinkle * 0.9;
          gl_PointSize = (1.2 + depth * 2.4) * (300.0 / -mv.z) * 0.01 * 100.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(0.62, 0.62, 0.68, vAlpha * smoothstep(0.5, 0.2, d));
        }
      `,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      material.uniforms.uTime.value = t;
      points.rotation.y = t * 0.06;
      points.rotation.x = t * 0.035;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="pointer-events-none absolute inset-0" />;
}

/* ================================================================== */
/* Variante Glassmorphism (Manuel)                                     */
/* ================================================================== */

interface CardProps {
  profile: Profile;
}

function GlassCard({ profile }: CardProps) {
  return (
    <div className="relative w-full max-w-[400px] rounded-3xl border border-white/15 bg-white/5 px-9 pb-9 pt-11 backdrop-blur-2xl flex flex-col items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_30px_70px_rgba(0,0,0,0.5)]">
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-[22px] border border-white/20 bg-white/10 text-[28px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
        {profile.initials}
      </div>
      <h1 className="mt-5 text-center text-[23px] font-semibold text-white">
        {profile.name}
      </h1>
      <p className="mt-2 text-[13px] uppercase tracking-[1.8px] text-white/55">
        CEO · MLG Studio
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={() => void handleDownloadContact(profile)}
          className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-violet-500 to-violet-500/65 text-[15px] font-semibold text-white shadow-[0_8px_26px_rgba(139,92,246,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] transition hover:brightness-110"
        >
          <UserPlus size={18} /> Añadir Contacto
        </button>
        <button
          type="button"
          onClick={handleOpenWebsite}
          className="flex h-[50px] items-center justify-center rounded-[14px] border border-white/15 bg-white/5 text-[15px] font-medium text-white/90 backdrop-blur transition hover:bg-white/10"
        >
          Entrar a nuestra página web
        </button>
      </div>
      <a
        href="/alvaro"
        className="mt-6 text-xs text-white/50 transition-colors duration-300 hover:text-white"
      >
        Ver tarjeta de Álvaro Rodríguez
      </a>
    </div>
  );
}

/* ================================================================== */
/* Variante Asimétrica / Elegante (Álvaro)                             */
/* ================================================================== */

function AsymmetricCard({ profile }: CardProps) {
  return (
    <div className="relative w-full max-w-[400px] rounded-[18px] border border-zinc-800 bg-[#121212] p-8 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
      <div className="flex items-start justify-between">
        <span className="pt-1.5 text-[11px] uppercase tracking-[2.6px] text-zinc-500">
          MLG Studio
        </span>
        <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[13px] bg-gradient-to-br from-violet-500 to-violet-500/60 text-[17px] font-semibold text-white">
          {profile.initials}
        </div>
      </div>
      <h1 className="mt-11 text-[31px] font-semibold leading-[1.12] text-zinc-100">
        {profile.firstName}
        <br />
        {profile.lastName}
      </h1>
      <p className="mt-3 text-sm text-zinc-500">CEO — MLG Studio</p>
      <div className="mt-7 h-px bg-zinc-800" />
      <div className="mt-6 grid grid-cols-[1fr_auto] gap-2.5">
        <button
          type="button"
          onClick={() => void handleDownloadContact(profile)}
          className="flex h-12 items-center justify-center rounded-[11px] bg-violet-500 px-4 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Añadir Contacto
        </button>
        <button
          type="button"
          onClick={handleOpenWebsite}
          className="flex h-12 items-center justify-center gap-1.5 rounded-[11px] border border-zinc-700 px-4 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900"
        >
          Página web <ArrowUpRight size={15} />
        </button>
      </div>
      <a
        href="/manuel"
        className="mt-5 inline-block text-xs text-zinc-500 transition-colors duration-300 hover:text-zinc-300"
      >
        Ver tarjeta de Manuel Vega
      </a>
    </div>
  );
}

/* ================================================================== */
/* Componente principal                                                */
/* ================================================================== */

export interface MLGVCardProps {
  /** "manuel" → Glassmorphism · "alvaro" → Asimétrico */
  person: PersonKey;
}

export default function MLGVCard({ person }: MLGVCardProps) {
  const profile = PROFILES[person];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-5">
      <DotsBackground />
      {/* Halo sutil tras la tarjeta glass */}
      {person === "manuel" && (
        <div className="pointer-events-none absolute h-[340px] w-[340px] rounded-full bg-violet-500/20 blur-3xl" />
      )}
      {person === "manuel" ? (
        <GlassCard profile={profile} />
      ) : (
        <AsymmetricCard profile={profile} />
      )}
    </div>
  );
}
