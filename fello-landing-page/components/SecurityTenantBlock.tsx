"use client";

import React, { useState } from "react";
import { Shield, Lock, Key, Server, Database, Check } from "lucide-react";

export default function SecurityTenantBlock() {
  const [activeTab, setActiveTab] = useState<"token" | "rules">("token");

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "2rem",
      alignItems: "stretch",
      marginTop: "2.5rem"
    }}>
      {/* Left: Visual Identity & Protection Card */}
      <div style={{
        backgroundColor: "var(--paper-soft)",
        border: "1px solid var(--line-strong)",
        borderRadius: "24px",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 10px 30px rgba(16,16,18,0.02)",
        position: "relative"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Identity Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ position: "relative" }}>
              <img
                src="/profile.jpg"
                alt="Kavindu Udhara"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  boxShadow: "0 4px 12px rgba(16,16,18,0.08)",
                  objectFit: "cover"
                }}
              />
              {/* Protection Badge Overlay */}
              <div style={{
                position: "absolute",
                bottom: "-2px",
                right: "-2px",
                backgroundColor: "var(--green)",
                color: "#ffffff",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                border: "2px solid #ffffff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
              }}>
                <Shield size={10} strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--ink)", margin: 0 }}>
                Kavindu Udhara
              </h4>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.1rem 0 0" }}>
                General Chair (sliit.lk)
              </p>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.6rem",
                color: "var(--green)",
                fontWeight: 800,
                backgroundColor: "var(--green-soft)",
                padding: "0.1rem 0.4rem",
                borderRadius: "4px",
                marginTop: "0.4rem"
              }}>
                <Lock size={8} /> Tenant-Isolated User
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}>
              <Check className="w-4 h-4 flex-shrink-0" style={{ marginTop: "0.15rem", color: "#101012" }} />
              <div>
                <strong>Domain-Scoped Claims</strong>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                  Your account is cryptographically tied to the institutional domain `sliit.lk` at authentication.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}>
              <Check className="w-4 h-4 flex-shrink-0" style={{ marginTop: "0.15rem", color: "#101012" }} />
              <div>
                <strong>Zero DB Read Rules</strong>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                  Permission evaluations happen in the JWT claims themselves. No slow DB reads to confirm access.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: "1px solid var(--line)",
          paddingTop: "1rem",
          marginTop: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.75rem",
          color: "var(--muted)"
        }}>
          <Server size={14} /> Host: app.fello.live/sliit-lk/ieee
        </div>
      </div>

      {/* Right: Code/Rule Inspector Panel */}
      <div style={{
        backgroundColor: "#101012",
        color: "#f6f4ee",
        borderRadius: "24px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: "1px solid rgba(255, 255, 255, 0.1)"
      }}>
        {/* Code tabs */}
        <div style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          backgroundColor: "rgba(255,255,255,0.02)"
        }}>
          <button
            onClick={() => setActiveTab("token")}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "0.75rem 0",
              fontSize: "0.75rem",
              fontWeight: 800,
              color: activeTab === "token" ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
              borderBottom: activeTab === "token" ? "2px solid var(--blue)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem"
            }}
          >
            <Key size={12} /> Decoded JWT Token
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "0.75rem 0",
              fontSize: "0.75rem",
              fontWeight: 800,
              color: activeTab === "rules" ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
              borderBottom: activeTab === "rules" ? "2px solid var(--blue)" : "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem"
            }}
          >
            <Database size={12} /> Firestore Rules
          </button>
        </div>

        {/* Code Block Container */}
        <div style={{
          flex: 1,
          padding: "1.25rem",
          fontFamily: "monospace",
          fontSize: "0.75rem",
          lineHeight: 1.45,
          color: "#22c55e",
          backgroundColor: "#0d0d0f"
        }}>
          {activeTab === "token" ? (
            <pre style={{ margin: 0, overflowX: "auto" }}>
{`// Cryptographically Signed JWT Token
{
  "uid": "user_kavindu_123",
  "email": "kavindu@sliit.lk",
  "whatsappVerified": true,
  "tenantId": "sliit.lk",
  "orgs": {
    "org_8f3k2a9x": {
      "access": "full",
      "nodeId": "sliit-ieee"
    }
  }
}`}
            </pre>
          ) : (
            <pre style={{ margin: 0, overflowX: "auto", color: "#60a5fa" }}>
{`// Firestore Rule Isolation Enforcement
match /organizations/{orgId} {
  allow read: if request.auth != null && 
    request.auth.token.tenantId == resource.data.tenantId;
    
  allow write: if request.auth != null && 
    request.auth.token.orgs[orgId].access == 'full';
}`}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
