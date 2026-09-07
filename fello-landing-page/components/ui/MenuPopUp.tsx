"use client";
import { useEffect, useRef, useState } from "react";
import GlassSurface from "./GlassSurface";

export type MenuPopUpItem = {
  title: string;
  description: string;
  href?: string;
  targetId?: string;
};

type MenuPopUpProps = {
  items: MenuPopUpItem[];
  isOpen: boolean;
  originRect: DOMRect | null;
  onClose: () => void;
  onItemClick?: (targetId: string) => void;
};

const ANIMATION_MS = 420;
const CLOSE_FADE_DELAY_MS = Math.round(ANIMATION_MS * 0.55);

export default function MenuPopUp({
  items,
  isOpen,
  originRect,
  onClose,
  onItemClick,
}: MenuPopUpProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [panelSize, setPanelSize] = useState<{ width: string; height: string }>({
    width: "100%",
    height: "100%",
  });
  const [panelOpacity, setPanelOpacity] = useState(1);
  const [backdropOpacity, setBackdropOpacity] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const getStartSize = () => {
    return {
      width: "72px",
      height: "72px",
    };
  };

  const getFinalSize = () => {
    if (typeof window === "undefined") {
      return {
        width: "100%",
        height: "100%",
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isSmallUp = viewportWidth >= 640;
    const maxWidth = 576; // max-w-xl equivalent
    const computedWidth = isSmallUp
      ? Math.min((viewportWidth * 8) / 12, maxWidth)
      : viewportWidth;

    return {
      width: `${computedWidth}px`,
      height: `${viewportHeight}px`,
    };
  };

  useEffect(() => {
    if (!isOpen) {
      if (!isVisible) return;

      setIsClosing(true);
      setPanelSize(getStartSize());
      setBackdropOpacity(0);
      setPanelOpacity(1);

      const fadeTimeout = window.setTimeout(() => {
        setPanelOpacity(0.2);
      }, CLOSE_FADE_DELAY_MS);

      const timeout = window.setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, ANIMATION_MS);

      return () => {
        window.clearTimeout(fadeTimeout);
        window.clearTimeout(timeout);
      };
    }

    setIsClosing(false);
    setIsVisible(true);
  }, [isOpen, isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const finalSize = getFinalSize();
    const startSize = getStartSize();
    setPanelSize(startSize);
    setPanelOpacity(0.3);
    setBackdropOpacity(0);

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        setPanelSize(finalSize);
        setPanelOpacity(1);
        setBackdropOpacity(1);
      });

      return () => window.cancelAnimationFrame(secondFrame);
    });

    return () => window.cancelAnimationFrame(firstFrame);
  }, [isVisible, originRect]);

  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        top: '4px',
        right: '4px',
        bottom: '4px',
        left: '4px',
        zIndex: 100,
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        transition: `background-color ${ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        backgroundColor: `rgba(0, 0, 0, ${0.45 * backdropOpacity})`,
        backdropFilter: `blur(${4 * backdropOpacity}px)`,
        WebkitBackdropFilter: `blur(${4 * backdropOpacity}px)`,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <GlassSurface
          ref={panelRef}
          borderRadius={{
            topLeft: 200,
            topRight: 300,
            bottomRight: 200,
            bottomLeft: 150,
          }}
          backgroundOpacity={0.92}
          brightness={98}
          className="absolute"
          style={{
            position: 'absolute',
            top: '-7rem',
            left: '35%',
            transform: 'translateX(-50%)',
            opacity: panelOpacity,
            width: panelSize.width,
            height: panelSize.height,
            transition: `width ${ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), height ${ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${isClosing ? 180 : ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${isClosing ? CLOSE_FADE_DELAY_MS : 0}ms`,
            willChange: "width, height, opacity",
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              paddingTop: '10rem',
              paddingLeft: '3rem',
              paddingRight: '2rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '2.5rem',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item, index) => {
              const order = String(index + 1).padStart(2, "0");

              return (
                <a
                  key={`${item.title}-${index}`}
                  href={item.href || "#"}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    textDecoration: 'none',
                    color: '#101012',
                  }}
                  onClick={(event) => {
                    if (!item.targetId || !onItemClick) return;
                    event.preventDefault();
                    onItemClick(item.targetId);
                    onClose();
                  }}
                >
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: '#ff6a21', fontFamily: 'monospace' }}>{order}</div>
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#101012', letterSpacing: '-0.02em' }}>{item.title}</div>
                    <div style={{ fontSize: '0.9rem', color: '#67645d', marginTop: '0.15rem' }}>{item.description}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}
