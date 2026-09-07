"use client";

import { useRef, useState } from "react";
import { Button } from "./ui/button";
import GlassSurface from "./ui/GlassSurface";
import { ArrowUpRight } from "lucide-react";

export function scrollToIdWithOffset(id: string, offset = 80) {
  const el = document.getElementById(id);
  if (el) {
    const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

export default function TopMenuBar() {
  const [showMenuPopUp, setShowMenuPopUp] = useState(false);
  const [menuOriginRect, setMenuOriginRect] = useState<DOMRect | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const menuPopUpItems = [
    {
      title: "Core Platform",
      description: "How Fello connects groups, tasks, and files",
      href: "#agent-showcase",
      targetId: "agent-showcase",
    },
    {
      title: "Security & Trust",
      description: "Tenant isolation enforced at every layer",
      href: "#tenant-architecture",
      targetId: "tenant-architecture",
    },
    {
      title: "Early Access",
      description: "See which domains are first in line",
      href: "#waitlist-leaderboard",
      targetId: "waitlist-leaderboard",
    },
  ];

  const toggleMenuPopUp = () => {
    setShowMenuPopUp(!showMenuPopUp);
  };

  return (
    <div style={{ position: 'sticky', width: '100%', top: 0, zIndex: 90, height: 0 }}>
      <GlassSurface
        height={showMenuPopUp ? 290 : 64}
        borderRadius={showMenuPopUp ? 24 : 999}
        backgroundOpacity={0.75}
        brightness={99}
        blur={15}
        style={{
          position: 'absolute',
          top: '18px',
          width: '90%',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '42rem',
          boxShadow: '0 8px 32px rgba(16, 16, 18, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          border: '1px solid rgba(16, 16, 18, 0.06)',
          transition: 'height 0.3s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          justifyContent: 'flex-start',
          padding: '0.25rem 0.5rem',
        }}>
          {/* Header Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            height: '48px',
          }}>
            {/* Logo Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                ref={menuTriggerRef}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  gap: '0.75rem'
                }}
                onClick={toggleMenuPopUp}
                aria-label="Toggle navigation"
                aria-expanded={showMenuPopUp}
              >
                <span style={{ position: 'relative', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      display: 'block',
                      height: '2px',
                      borderRadius: '1px',
                      backgroundColor: '#101012',
                      transition: 'all 0.3s ease-out',
                      width: showMenuPopUp ? "20px" : "14px",
                      transform: showMenuPopUp ? "translateY(0px) rotate(45deg)" : "translateY(-5px) rotate(0deg)",
                      left: 0
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      display: 'block',
                      height: '2px',
                      width: '20px',
                      borderRadius: '1px',
                      backgroundColor: '#101012',
                      transition: 'all 0.3s ease-out',
                      opacity: showMenuPopUp ? 0 : 1,
                      transform: showMenuPopUp ? "translateX(-6px)" : "translateX(0px)",
                      left: 0
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      display: 'block',
                      height: '2px',
                      borderRadius: '1px',
                      backgroundColor: '#101012',
                      transition: 'all 0.3s ease-out',
                      width: showMenuPopUp ? "20px" : "14px",
                      transform: showMenuPopUp ? "translateY(0px) rotate(-45deg)" : "translateY(5px) rotate(0deg)",
                      left: 0
                    }}
                  />
                </span>
                <span className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.2rem', fontWeight: 900, color: '#101012' }}>
                  <img src="/fello-logo.svg" alt="Fello Logo" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
                  <span className="brand-text">fello</span>
                </span>
              </button>
            </div>

            {/* Desktop Navigation Links */}
            <nav style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }} className="nav-links">
              <Button
                variant="light"
                style={{ borderRadius: '999px', border: 'none', background: 'transparent', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#67645d' }}
                onClick={() => scrollToIdWithOffset("agent-showcase", 100)}
              >
                Platform
              </Button>
              <Button
                variant="light"
                style={{ borderRadius: '999px', border: 'none', background: 'transparent', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#67645d' }}
                onClick={() => scrollToIdWithOffset("tenant-architecture", 100)}
              >
                Security
              </Button>
              <Button
                variant="light"
                style={{ borderRadius: '999px', border: 'none', background: 'transparent', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#67645d' }}
                onClick={() => scrollToIdWithOffset("waitlist-leaderboard", 100)}
              >
                Waitlist
              </Button>
            </nav>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <a
                href="https://app.fello.live"
                className="btn btn-dark"
                style={{
                  minHeight: '36px',
                  padding: '0 1rem',
                  fontSize: '0.85rem',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontWeight: 700,
                  backgroundColor: '#101012',
                  color: '#fffdf7'
                }}
              >
                <span>App</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Expanded Menu Options */}
          {showMenuPopUp && (
            <div style={{
              borderTop: '1px solid rgba(16, 16, 18, 0.08)',
              marginTop: '0.75rem',
              paddingTop: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              width: '100%',
              paddingLeft: '0.75rem',
              paddingRight: '0.75rem',
            }}>
              {menuPopUpItems.map((item, index) => {
                const order = String(index + 1).padStart(2, "0");
                return (
                  <a
                    key={`${item.title}-${index}`}
                    href={item.href || "#"}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      textDecoration: 'none',
                      color: '#101012',
                    }}
                    onClick={(event) => {
                      if (!item.targetId) return;
                      event.preventDefault();
                      scrollToIdWithOffset(item.targetId, 100);
                      setShowMenuPopUp(false);
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'rgba(16, 16, 18, 0.4)', fontFamily: 'monospace' }}>{order}</div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#101012', letterSpacing: '-0.01em' }}>{item.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#67645d', marginTop: '0.1rem' }}>{item.description}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </GlassSurface>
    </div>
  );
}
