"use client";

import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";

type ProfileDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ProfileDrawer({ open, onOpenChange }: ProfileDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <DrawerContent
        className="!bg-transparent !border-none !shadow-none"
        style={{ background: "transparent", border: "none", boxShadow: "none" }}
      >
        {/* Centered card */}
        <div style={{
          maxWidth: "36rem",
          width: "calc(100% - 2rem)",
          margin: "0 auto 1.5rem",
          background: "#fff",
          borderRadius: "20px",
          boxShadow: "0 8px 40px rgba(16,16,18,0.12), 0 1px 4px rgba(16,16,18,0.06)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "1.75rem 2rem 2rem",
          gap: "0.85rem",
        }}>
          {/* Swipe handle */}
          <div style={{
            width: "2.5rem",
            height: "4px",
            borderRadius: "99px",
            background: "rgba(16,16,18,0.12)",
            marginBottom: "0.5rem",
          }} />

          {/* Profile photo */}
          <img
            src="/profile.jpg"
            alt="Kavindu Udhara"
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "top",
              border: "2.5px solid rgba(16,16,18,0.1)",
              flexShrink: 0,
            }}
          />

          {/* Name */}
          <h2 style={{
            fontSize: "1.05rem",
            fontWeight: 800,
            color: "#101012",
            letterSpacing: "-0.02em",
            margin: 0,
          }}>
            Kavindu Udhara
          </h2>

          {/* Easter egg bio */}
          <p style={{
            fontSize: "0.85rem",
            color: "#888",
            margin: 0,
            lineHeight: 1.65,
          }}>
            Hey, I didn&apos;t think you&apos;d see this. This is a hidden feature. Click the button below to get to know me better.
          </p>

          {/* Portfolio link */}
          <a
            href="https://kavindu-dev.web.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.55rem 1.5rem",
              borderRadius: "999px",
              border: "3px solid #101012",
              background: "#101012",
              color: "#fff",
              fontSize: "0.82rem",
              fontWeight: 700,
              textDecoration: "none",
              marginTop: "0.25rem",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.75"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            Portfolio
          </a>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
