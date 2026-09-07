"use client";

import React from "react";
import { Lock, Shield } from "lucide-react";
import GlassSurface from "./ui/GlassSurface";

const googleIconsInner = [
  { name: "WhatsApp", icon: "/google-icons/whatsapp.svg", angle: 45 },
  { name: "Drive", icon: "/google-icons/drive.png", angle: 135 },
  { name: "Gmail", icon: "/google-icons/gmail.webp", angle: 225 },
  { name: "Sheets", icon: "/google-icons/sheets.webp", angle: 315 },
];

const googleIconsOuter = [
  { name: "Docs", icon: "/google-icons/docs.webp", angle: 0 },
  { name: "Forms", icon: "/google-icons/forms.webp", angle: 90 },
  { name: "Calendar", icon: "/google-icons/calendar.png", angle: 180 },
  { name: "Contacts", icon: "/google-icons/contacts.webp", angle: 270 },
];

const ghostTenants = [
  { domain: "nsbm.ac.lk", side: "left" as const, rot: -6 },
  { domain: "uom.lk", side: "right" as const, rot: 7 },
];

function OrbitLine({
  icons,
  radius,
}: {
  icons: { name: string; icon: string; angle: number }[];
  radius: string;
}) {
  return (
    <div className="absolute left-1/2 top-1/2">
      {icons.map(({ name, icon, angle }) => (
        <div
          key={name}
          className="absolute left-1/2 top-1/2"
          style={{ transform: `rotate(${angle}deg) translate(${radius}) rotate(-${angle}deg)` }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              border: "1px solid var(--line-strong)",
              boxShadow: "0 4px 12px rgba(16,16,18,0.06)",
              padding: "8px",
              transform: "translate(-50%, -50%)",
            }}
          >
            <img src={icon} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TenantArchitectureShowcase() {
  return (
    <div className="w-full flex flex-col items-center pb-6">

      {/* Header */}
      <div className="max-w-lg text-center flex flex-col items-center mb-4">
        <span className="section-kicker mb-2">Tenant Isolation</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          Every organization gets its own sealed space.
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          The moment you sign in, your institution's domain becomes your access boundary. Every check happens at three separate layers — your session, the database rules, and every single query — so a request from outside your organization is rejected before it ever reaches your data.
        </p>
      </div>

      {/* Vault Scene */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{ height: "min(64vw, 460px)", maxWidth: "820px" }}
      >
        {/* Outer dashed boundary ring */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: "min(60vw, 430px)",
            height: "min(60vw, 430px)",
            borderRadius: "50%",
            border: "1.5px dashed var(--line-strong)",
          }}
        />
        {/* Inner dashed ring */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: "min(38vw, 270px)",
            height: "min(38vw, 270px)",
            borderRadius: "50%",
            border: "1px solid var(--line)",
          }}
        />

        {/* Connected Google products — two orbiting lines around the tenant boundary */}
        <OrbitLine icons={googleIconsInner} radius="min(19vw, 135px)" />
        <OrbitLine icons={googleIconsOuter} radius="min(30vw, 215px)" />

        {/* Ghost tenants — other orgs, visible but sealed off */}
        {ghostTenants.map((g) => (
          <div
            key={g.domain}
            className="tenant-ghost-disc absolute flex flex-col items-center gap-1.5"
            style={{
              [g.side]: "-6%",
              top: g.side === "left" ? "12%" : "58%",
              ["--ghost-rot" as string]: `${g.rot}deg`,
              animationDelay: g.side === "left" ? "0s" : "1.4s",
            } as React.CSSProperties}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                width: "76px",
                height: "76px",
                borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.5)",
                backdropFilter: "blur(6px) saturate(1.2)",
                WebkitBackdropFilter: "blur(6px) saturate(1.2)",
                border: "1px solid var(--line-strong)",
                boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.5), 0 6px 18px rgba(16,16,18,0.05)",
                opacity: 0.7,
              }}
            >
              <span className="text-[9px] font-extrabold text-[var(--muted)] uppercase tracking-wide text-center px-1 leading-tight">
                {g.domain}
              </span>
              <div
                className="absolute flex items-center justify-center"
                style={{
                  bottom: "-4px",
                  right: "-4px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "#101012",
                  border: "2px solid #ffffff",
                }}
              >
                <Lock size={9} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
            <span className="text-[9px] font-bold text-[var(--muted)] opacity-70 uppercase tracking-wide">
              No access
            </span>
          </div>
        ))}

        {/* Center: your tenant, rendered in real glass — clean, no logo */}
        <GlassSurface
          width={200}
          height={200}
          borderRadius={999}
          backgroundOpacity={0.75}
          brightness={99}
          blur={15}
          distortionScale={-80}
          style={{
            position: "relative",
            zIndex: 10,
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            border: "1px solid rgba(16, 16, 18, 0.06)",
            boxShadow: "0 8px 32px rgba(16, 16, 18, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
          }}
        >
          <div className="flex flex-col items-center justify-center text-center gap-1.5 px-2">
            <div className="text-xs font-extrabold text-[var(--ink)] leading-tight">SLIIT IEEE IAS</div>
            <div className="text-[9px] font-semibold text-[var(--muted)]">sliit.lk</div>
            <div
              className="inline-flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ color: "var(--green)", backgroundColor: "var(--green-soft)" }}
            >
              <Shield size={8} /> Your Tenant
            </div>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}
