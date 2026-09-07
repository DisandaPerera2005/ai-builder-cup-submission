"use client";

import React, { useState } from "react";
import TopMenuBar from "../components/TopMenuBar";
import GlassSurface from "../components/ui/GlassSurface";
import { BackgroundRippleEffect } from "../components/ui/background-ripple-effect";
import { Cover } from "../components/ui/cover";
import { FlipWords } from "../components/ui/flip-words";
import FelloShowcase from "../components/FelloShowcase";
import DropOnboardingShowcase from "../components/DropOnboardingShowcase";
import CoordinationShowcase from "../components/CoordinationShowcase";
import BulkExecutionShowcase from "../components/BulkExecutionShowcase";
import RememberFindShowcase from "../components/RememberFindShowcase";
import SeesWhatHumansMissShowcase from "../components/SeesWhatHumansMissShowcase";
import TextHoverEffectDemo from "../components/text-hover-effect-demo";
import TenantArchitectureShowcase from "../components/TenantArchitectureShowcase";
import WaitlistLeaderboard from "../components/WaitlistLeaderboard";

import SecurityTenantBlock from "../components/SecurityTenantBlock";
import ProfileDrawer from "../components/ProfileDrawer";
import { 
  MessageSquare, 
  GitMerge, 
  HardDrive, 
  Clock, 
  ShieldCheck, 
  Layers, 
  CheckCircle,
  HelpCircle,
  FileCheck2,
  Lock,
  ArrowRight
} from "lucide-react";

export default function Home() {
  const [profileOpen, setProfileOpen] = useState(false);

  // Light bulb state (mirrored from Fello dashboard)
  const [lightOn, setLightOn] = useState(false);
  const [introFlashOn, setIntroFlashOn] = useState(false);
  const introFlashStartedRef = React.useRef(false);
  const introFlashTimersRef = React.useRef<number[]>([]);
  const occasionalTimerRef = React.useRef<number | null>(null);
  const lightOnRef = React.useRef(false);
  const beamVisible = lightOn || introFlashOn;

  // Keep a ref in sync so the occasional flash closure can read latest value
  React.useEffect(() => { lightOnRef.current = lightOn; }, [lightOn]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      introFlashTimersRef.current.forEach((t) => window.clearTimeout(t));
      if (occasionalTimerRef.current) window.clearTimeout(occasionalTimerRef.current);
    };
  }, []);

  // Occasional random flash — 2 or 3 times, every 8–15 s, only when bulb is off
  const scheduleOccasionalFlash = React.useCallback(() => {
    const delay = 8000 + Math.random() * 7000; // 8–15 s
    occasionalTimerRef.current = window.setTimeout(() => {
      if (!lightOnRef.current) {
        const count = Math.random() < 0.5 ? 2 : 3; // 2 or 3 flashes
        const steps: { delay: number; on: boolean }[] = [];
        let t = 0;
        for (let i = 0; i < count; i++) {
          steps.push({ delay: t, on: true });
          t += 130;
          steps.push({ delay: t, on: false });
          t += 140;
        }
        const timers = steps.map(({ delay: d, on }) =>
          window.setTimeout(() => setIntroFlashOn(on), d)
        );
        introFlashTimersRef.current.push(...timers);
      }
      scheduleOccasionalFlash(); // reschedule
    }, delay);
  }, []);

  const startIntroFlash = React.useCallback(() => {
    if (introFlashStartedRef.current) return;
    introFlashStartedRef.current = true;
    // Initial double-flash on load
    const steps = [
      { delay: 120, on: true },
      { delay: 260, on: false },
      { delay: 400, on: true },
      { delay: 560, on: false },
    ];
    introFlashTimersRef.current = steps.map(({ delay, on }) =>
      window.setTimeout(() => setIntroFlashOn(on), delay)
    );
    // Start the occasional flash loop after the intro
    window.setTimeout(scheduleOccasionalFlash, 2000);
  }, [scheduleOccasionalFlash]);

  const integrationIcons = [
    { name: "WhatsApp", icon: "/google-icons/whatsapp.svg", r: 30, angle: 45 },
    { name: "Drive", icon: "/google-icons/drive.png", r: 30, angle: 135 },
    { name: "Gmail", icon: "/google-icons/gmail.webp", r: 30, angle: 0 },
    { name: "Sheets", icon: "/google-icons/sheets.webp", r: 30, angle: 315 },
    { name: "Docs", icon: "/google-icons/docs.webp", r: 45, angle: 22.5 },
    { name: "Forms", icon: "/google-icons/forms.webp", r: 45, angle: 90 },
    { name: "Calendar", icon: "/google-icons/calendar.png", r: 45, angle: 180 },
    { name: "Contacts", icon: "/google-icons/contacts.webp", r: 45, angle: 270 },
  ];

  const heroMessageIcons = [
    { name: "WhatsApp", icon: "/google-icons/whatsapp.svg", x: 4, y: 42, size: "large", delay: "-0.4s", driftX: "10px", driftY: "-16px" },
    { name: "Drive", icon: "/google-icons/drive.png", x: 17, y: 9, size: "medium", delay: "-2.2s", driftX: "-12px", driftY: "14px" },
    { name: "Gmail", icon: "/google-icons/gmail.webp", x: 46, y: 3, size: "small", delay: "-1.1s", driftX: "14px", driftY: "10px" },
    { name: "Sheets", icon: "/google-icons/sheets.webp", x: 83, y: 17, size: "medium", delay: "-3.1s", driftX: "-10px", driftY: "-14px" },
    { name: "Docs", icon: "/google-icons/docs.webp", x: 96, y: 57, size: "large", delay: "-1.8s", driftX: "-14px", driftY: "13px" },
    { name: "Forms", icon: "/google-icons/forms.webp", x: 73, y: 94, size: "small", delay: "-2.7s", driftX: "12px", driftY: "-10px" },
    { name: "Calendar", icon: "/google-icons/calendar.png", x: 37, y: 89, size: "medium", delay: "-0.9s", driftX: "-13px", driftY: "-12px" },
    { name: "Contacts", icon: "/google-icons/contacts.webp", x: 8, y: 76, size: "small", delay: "-3.6s", driftX: "11px", driftY: "15px" },
  ];

  const features = [
    {
      icon: <MessageSquare className="w-5 h-5 text-blue-600" />,
      iconBg: "var(--blue-soft)",
      title: "WhatsApp Native",
      body: "Volunteers collaborate in standard group chats. Fello listens in the background, identifying tasks and deliverables automatically."
    },
    {
      icon: <GitMerge className="w-5 h-5 text-blue-600" />,
      iconBg: "var(--blue-soft)",
      title: "Structure Encoded",
      body: "Map your branch committees, chapters, and executive roles once. The AI agent instantly knows who leads each team and who handles what."
    },
    {
      icon: <HardDrive className="w-5 h-5 text-blue-600" />,
      iconBg: "var(--blue-soft)",
      title: "Google Drive Routing",
      body: "Files uploaded in WhatsApp groups get saved to the correct institutional folders automatically, keeping your repository clean."
    },
    {
      icon: <Clock className="w-5 h-5 text-blue-600" />,
      iconBg: "var(--blue-soft)",
      title: "Automated Reminders",
      body: "The agent negotiates deadlines, manages team availability in chat, and sends reminders without a coordinator chasing everyone."
    },
    {
      icon: <Layers className="w-5 h-5 text-blue-600" />,
      iconBg: "var(--blue-soft)",
      title: "Centralized Dashboard",
      body: "An overview of active events, task statuses, member workloads, and document flows. Searchable via conversational queries."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      iconBg: "var(--blue-soft)",
      title: "Tenant Isolation",
      body: "Built for data-sensitive environments. Scoped JWT claims, separate databases, and Firestore RLS ensure total tenant separation."
    }
  ];

  const steps = [
    {
      title: "1. Declare Event",
      body: "Write a single WhatsApp message: 'We have a new event called PTI 2026. Set up the team groups.'"
    },
    {
      title: "2. Automatic Setup",
      body: "Fello creates the relevant WhatsApp groups, adds members based on roles, and creates Drive folders."
    },
    {
      title: "3. Chat to Task",
      body: "Assign tasks and set deadlines naturally in the chat. Fello parses the details and updates the dashboard."
    },
    {
      title: "4. Live Visibility",
      body: "Ask Fello 'what is the status of PTI 2026?' in chat or view the visual dashboard for real-time progress."
    }
  ];

  return (
    <main className="page-shell">
      {/* Premium Glass Top Nav Bar */}
      <TopMenuBar />

      {/* Hero Section with 3D Logo Floor centerpiece and behind-text styling */}
      <section className="hero" id="top" style={{ paddingBottom: "100px", minHeight: "100vh" }}>
        {/* Interactive click-to-ripple background grid */}
        <BackgroundRippleEffect />

        {/* Light bulb — constrained to same max-w as top nav bar (42rem) */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          maxWidth: "42rem",
          margin: "0 auto",
          pointerEvents: "none",
          zIndex: 1,
        }}>
          {/* Beam */}
          {beamVisible && (
            <>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: "0.7rem",
                  top: "8rem",
                  height: "18rem",
                  width: "10rem",
                  transformOrigin: "center top",
                  background: "linear-gradient(rgba(250,204,21,0.52), rgba(250,204,21,0.24) 42%, transparent 100%)",
                  clipPath: "polygon(35% 0px, 65% 0px, 100% 100%, 0px 100%)",
                  filter: "blur(18px)",
                  mixBlendMode: "multiply",
                  pointerEvents: "none",
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: "6rem",
                  top: "57rem",
                  width: "3.5rem",
                  height: "3.5rem",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(250,204,21,0.55), rgba(250,204,21,0.18) 58%, transparent 76%)",
                  filter: "blur(2px)",
                  mixBlendMode: "multiply",
                  transform: "rotate(-12deg)",
                  pointerEvents: "none",
                }}
              />
            </>
          )}
          {/* Bulb button */}
          <button
            type="button"
            aria-pressed={lightOn}
            aria-label={lightOn ? "Turn light bulb off" : "Turn light bulb on"}
            onClick={() => setLightOn((v) => !v)}
            style={{
              position: "absolute",
              top: "-0.5rem",
              right: "0.75rem",
              width: "9rem",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              pointerEvents: "auto",
              transition: "transform 0.15s ease",
              zIndex: 2,
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <img
              src="/light-bulb.png"
              alt=""
              onLoad={startIntroFlash}
              style={{
                width: "100%",
                filter: beamVisible
                  ? "brightness(1.1) saturate(1.25) drop-shadow(0 0 18px rgba(250,204,21,0.55))"
                  : "drop-shadow(0 4px 8px rgba(16,16,18,0.15))",
                transition: "filter 0.2s ease",
              }}
            />
          </button>
        </div>


        <div className="hero-copy" style={{ zIndex: 10, width: "100%", maxWidth: "1100px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>

          <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
            <div style={{
              fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)",
              fontWeight: 500,
              color: "var(--muted)",
              lineHeight: 1.4,
              marginBottom: "0.5rem"
            }}>
              new era of managing your whatsapp based
            </div>
            <h1 style={{
              fontSize: "clamp(48px, 9vw, 98px)",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.04em",
              lineHeight: 0.9,
              margin: "0 auto",
              color: "var(--ink)"
            }}>
              <FlipWords
                words={["ORGANIZATION", "CLUB", "SOCIETY", "CHAPTER", "COMMITTEE"]}
                className="!p-0 !text-[var(--ink)]"
              />
            </h1>
          </div>

          {/* Large 3D Scene Container: tilted floor with logo, and your cutout standing on the circle */}
          <div className="scene-container" style={{ position: "relative", zIndex: 5 }}>

            {/* Tilted 3D Floor Plane */}
            <div className="floor-plane">
              <div
                className="floor-logo"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%) translateZ(0px)",
                  width: "78svw",
                  height: "78svw",
                  maxWidth: "700px",
                  maxHeight: "700px",
                  minWidth: "340px",
                  minHeight: "340px",
                  opacity: 0.95,
                  // Replicate top menu bar shadow using drop-shadow so it conforms to the mask shape
                  filter: "drop-shadow(0 8px 32px rgba(16, 16, 18, 0.08)) drop-shadow(0 2px 8px rgba(16, 16, 18, 0.04))",
                }}
              >
                <GlassSurface
                  borderRadius={0}
                  backgroundOpacity={0.75} // Matches top menu bar
                  brightness={99} // Matches top menu bar
                  blur={15} // Matches top menu bar
                  borderWidth={0.06} // Matches top menu bar
                  distortionScale={-80}
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(255, 255, 255, 0.7)", // Matches top menu bar
                    maskImage: "url(/fello-logo.svg)",
                    WebkitMaskImage: "url(/fello-logo.svg)",
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  {/* Specular Highlights SVG overlay with border and glass filters */}
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 171 171"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                    }}
                  >
                    <defs>
                      {/* Glass linear gradient */}
                      <linearGradient id="glass-grad-floor" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.75)" />
                        <stop offset="30%" stopColor="rgba(255, 255, 255, 0.45)" />
                        <stop offset="70%" stopColor="rgba(240, 240, 245, 0.25)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0.55)" />
                      </linearGradient>

                      {/* Highlight gradient */}
                      <linearGradient id="highlight-grad-floor" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                      </linearGradient>

                      {/* Outer dark border filter - matches rgba(16, 16, 18, 0.06) border */}
                      <filter id="outer-dark-border" x="-20%" y="-20%" width="140%" height="140%">
                        <feMorphology operator="dilate" radius="1.2" in="SourceAlpha" result="dilated" />
                        <feComposite operator="out" in="dilated" in2="SourceAlpha" result="outline" />
                        <feFlood floodColor="#101012" floodOpacity="0.06" result="color" />
                        <feComposite operator="in" in="color" in2="outline" />
                      </filter>

                      {/* Inner light rim filter (inset highlight shadow) - matches inset 0 1px 0 rgba(255, 255, 255, 0.5) */}
                      <filter id="inner-light-rim" x="-20%" y="-20%" width="140%" height="140%">
                        <feMorphology operator="erode" radius="1.2" in="SourceAlpha" result="eroded" />
                        <feComposite operator="out" in="SourceAlpha" in2="eroded" result="outline" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.5" result="color" />
                        <feComposite operator="in" in="color" in2="outline" />
                      </filter>
                    </defs>

                    {/* Mask defining the unified logo shape */}
                    <mask id="inner-logo-mask">
                      <rect width="171" height="171" fill="black" />
                      <g fill="white">
                        <circle cx="46.5" cy="62.5" r="27.5" />
                        <circle cx="99" cy="128" r="21" />
                        <path d="M78 130C78 95.9081 72 102.5 36 88.0001C49.8333 74.5001 73.7673 61.4755 74 64.5001C76 90.4999 80 97 103.5 107.5C105.783 108.52 78 131.5 78 130Z" />
                        <circle cx="111" cy="70" r="22" />
                      </g>
                    </mask>

                    {/* Glass Base Body */}
                    <rect
                      width="171"
                      height="171"
                      fill="url(#glass-grad-floor)"
                      mask="url(#inner-logo-mask)"
                    />

                    {/* Outer dark border (fine line representing the glass boundary) */}
                    <g filter="url(#outer-dark-border)">
                      <circle cx="46.5" cy="62.5" r="27.5" fill="white" />
                      <circle cx="99" cy="128" r="21" fill="white" />
                      <path d="M78 130C78 95.9081 72 102.5 36 88.0001C49.8333 74.5001 73.7673 61.4755 74 64.5001C76 90.4999 80 97 103.5 107.5C105.783 108.52 78 131.5 78 130Z" fill="white" />
                      <circle cx="111" cy="70" r="22" fill="white" />
                    </g>

                    {/* Inner light rim (highlight refraction along the inner edge offset slightly for 3D look) */}
                    <g filter="url(#inner-light-rim)" transform="translate(0, 1)">
                      <circle cx="46.5" cy="62.5" r="27.5" fill="white" />
                      <circle cx="99" cy="128" r="21" fill="white" />
                      <path d="M78 130C78 95.9081 72 102.5 36 88.0001C49.8333 74.5001 73.7673 61.4755 74 64.5001C76 90.4999 80 97 103.5 107.5C105.783 108.52 78 131.5 78 130Z" fill="white" />
                      <circle cx="111" cy="70" r="22" fill="white" />
                    </g>

                    {/* Specular highlights on top */}
                    <g fill="url(#highlight-grad-floor)" opacity="0.85">
                      <circle cx="40" cy="51" r="13" />
                      <circle cx="94" cy="119" r="10" />
                      <circle cx="106" cy="61" r="11" />
                    </g>
                  </svg>
                </GlassSurface>
              </div>
              {/* Dashed Orbital Rings representing coordination mapping */}
              <div className="orbital-ring-outer" />
              <div className="orbital-ring-inner" />

              {/* Integration Tokens orbiting around the logo */}
              {integrationIcons.map((ico, idx) => {
                const rad = (ico.angle * Math.PI) / 180;
                const x = 50 + ico.r * Math.cos(rad);
                const y = 50 + ico.r * Math.sin(rad);

                return (
                  <div
                    key={idx}
                    className="integration-token"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                    }}
                  >
                    <img
                      src={ico.icon}
                      alt={ico.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Glowing pedestal backing reflection underneath the standing cutout */}
            <div className="pedestal-backing" />

            {/* MUCH BIGGER raw cutout of you standing directly on top of the logo circle */}
          {/* Person image — clickable to open profile drawer */}
            <img
              src="/me-lost.png"
              alt="Kavindu Udhara standing on Fello logo circle"
              className="cutout-standing"
              onClick={() => setProfileOpen(true)}
              style={{ cursor: "pointer" }}
            />
          </div>

          <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} />


        </div>
      </section>

      <section className="message-band" aria-label="One message away from getting it done">
        <div className="hero-message-cloud">
          {heroMessageIcons.map((icon) => (
            <div
              key={icon.name}
              className={`hero-message-icon hero-message-icon-${icon.size}`}
                style={{
                  left: `${icon.x}%`,
                  top: `${icon.y}%`,
                  "--icon-drift-x": icon.driftX,
                  "--icon-drift-y": icon.driftY,
                  "--icon-delay": icon.delay,
                } as React.CSSProperties}
              >
              <img src={icon.icon} alt="" />
            </div>
          ))}
          <div className="hero-message-text">
            One message away
            <span>
              from getting it <Cover className="hero-cover-word">done</Cover>
            </span>
          </div>
        </div>
      </section>

      {/* Interactive AI Agent Chat Showcase Section */}
      <section id="agent-showcase" style={{ borderTop: "1px solid var(--line)", backgroundColor: "#ffffff" }}>
        <div className="section-inner" style={{ maxWidth: "1060px" }}>
          <DropOnboardingShowcase />
        </div>
      </section>

      {/* Autonomous Coordination Section */}
      <section id="autonomous-coordination" style={{ borderTop: "1px solid var(--line)", backgroundColor: "#ffffff" }}>
        <div className="section-inner" style={{ maxWidth: "1060px" }}>
          <CoordinationShowcase />
        </div>
      </section>

      {/* Bulk Execution Section */}
      <section id="bulk-execution" style={{ borderTop: "1px solid var(--line)", backgroundColor: "#ffffff" }}>
        <div className="section-inner" style={{ maxWidth: "1060px" }}>
          <BulkExecutionShowcase />
        </div>
      </section>

      {/* Remember & Find Section */}
      <section id="remember-find" style={{ borderTop: "1px solid var(--line)", backgroundColor: "#ffffff" }}>
        <div className="section-inner" style={{ maxWidth: "1060px" }}>
          <RememberFindShowcase />
        </div>
      </section>

      {/* Sees What Humans Miss + Tenant Architecture Section (kept together, no divider) */}
      <section id="sees-what-humans-miss" style={{ borderTop: "1px solid var(--line)", backgroundColor: "#ffffff", paddingBottom: "20px" }}>
        <div className="section-inner" style={{ maxWidth: "1060px" }}>
          <SeesWhatHumansMissShowcase />
          <TextHoverEffectDemo />
        </div>
        <div id="tenant-architecture" className="section-inner" style={{ maxWidth: "1060px", marginTop: "-40px" }}>
          <TenantArchitectureShowcase />
        </div>
      </section>

      {/* Waitlist Leaderboard Section */}
      <section id="waitlist-leaderboard" style={{ borderTop: "1px solid var(--line)", backgroundColor: "#ffffff" }}>
        <div className="section-inner" style={{ maxWidth: "1060px" }}>
          <WaitlistLeaderboard />
        </div>
      </section>

      <footer className="footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem', fontWeight: 900, color: '#101012' }}>
          <img src="/fello-logo.svg" alt="Fello Logo" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
          <span className="brand-text">fello</span>
        </div>

        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          © {new Date().getFullYear()} fello.live. All rights reserved.
        </span>
      </footer>
    </main>
  );
}
