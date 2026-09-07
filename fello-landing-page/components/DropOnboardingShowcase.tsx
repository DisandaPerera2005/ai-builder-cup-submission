"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  Plus,
  ArrowUp,
  ChevronDown,
  Wrench,
  ExternalLink,
  Upload,
  Building2,
  FileText,
  Mail,
  MessageSquare,
  ChevronsUpDown
} from "lucide-react";

export default function DropOnboardingShowcase() {
  const [toolCallsOpen, setToolCallsOpen] = useState(false);

  // Real tool calls matching Fello ADK agent skills
  const toolCalls = [
    { name: "find_document", count: "fired 1 time" },
    { name: "list_pending_invite_suggestions", count: "fired 1 time" },
    { name: "invite_org_members", count: "fired 6 times" },
    { name: "send_org_invite_emails", count: "fired 6 times" },
    { name: "send_whatsapp_message", count: "fired 6 times" }
  ];

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-6">
      
      {/* Left Column: Big Bold Sticky Showcase Text */}
      <div className="lg:col-span-5 flex flex-col justify-start text-left lg:sticky lg:top-28 self-start pt-4 lg:pt-8 pb-4 lg:pb-8">
        <span className="section-kicker mb-2">Instant Setup</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          Starting your org is stupidly simple.
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          Create your workspace, connect Google Drive and WhatsApp, and drop a member list. Fello adds everyone with the right roles and access.
        </p>
      </div>

      {/* Right Column: Visual Mockups Stacked Top to Bottom */}
      <div className="lg:col-span-7 flex flex-col items-center gap-0">
        
        {/* 1. Create Organization Card (matching fello-frontend sidebar select switcher) */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "12px"
          }} 
          className="w-full p-3 px-3.5 flex items-center justify-between gap-3 relative cursor-pointer hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-left min-w-0">
            {/* Logo container matching sidebar switcher exactly */}
            <div className="relative shrink-0 select-none">
              <div className="size-10 flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden border border-border/80 p-1">
                <img src="/google-icons/ieee.png" className="size-full object-contain" alt="IEEE Logo" />
              </div>
              {/* Unverified Workspace warning badge */}
              <div 
                title="Unverified Workspace" 
                className="absolute bottom-0 right-0 size-3 bg-yellow-500 rounded-full p-0.5 flex items-center justify-center text-white shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="size-full fill-current" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="font-medium text-sm leading-tight text-[var(--ink)] truncate">IEEE</span>
              <span className="text-xs text-muted-foreground leading-tight mt-0.5">Workspace</span>
            </div>
          </div>
        </div>

        {/* SVG Flow Connector 1 (Entering Google Drive) */}
        <div className="h-8 flex items-center justify-center">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300">
            <path d="M3 4V28" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" />
            <circle cx="3" cy="3" r="2" fill="currentColor" />
            <circle cx="3" cy="29" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 2. Connect Integrations (Stacked with waitlist border radius effect, wrapper card removed) */}
        <div className="w-full flex flex-col">
          
          {/* Google Drive Block */}
          <div 
            style={{ 
              backgroundColor: "#ffffff", 
              border: "1px solid var(--line-strong)",
              borderBottom: "none",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
              borderBottomLeftRadius: "0px",
              borderBottomRightRadius: "0px"
            }} 
            className="p-3.5 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[var(--muted)] border border-[var(--line)]">
                <img src="/google-icons/drive.png" className="size-5 object-contain" alt="Google Drive" />
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-3 pt-0.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--ink)]">Google Drive</p>
                  <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">Using workspace@ieee-org.com for project files.</p>
                </div>
                <button 
                  type="button" 
                  className="shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--muted)] text-[10px] font-bold px-3 py-1 cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  Connected
                </button>
              </div>
            </div>
          </div>

          {/* WhatsApp Block */}
          <div 
            style={{ 
              backgroundColor: "#ffffff", 
              border: "1px solid var(--line-strong)",
              borderTopLeftRadius: "0px",
              borderTopRightRadius: "0px",
              borderBottomLeftRadius: "16px",
              borderBottomRightRadius: "16px"
            }} 
            className="p-3.5 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[var(--muted)] border border-[var(--line)]">
                <img src="/google-icons/whatsapp.svg" className="size-5 object-contain" alt="WhatsApp" />
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between gap-3 pt-0.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--ink)]">WhatsApp Gateway</p>
                  <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">Ready for WhatsApp invitation coordination.</p>
                </div>
                <button 
                  type="button" 
                  className="shrink-0 rounded-full border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--muted)] text-[10px] font-bold px-3 py-1 cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  Ready
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* SVG Flow Connector 2 (Leaving WhatsApp) */}
        <div className="h-8 flex items-center justify-center">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300">
            <path d="M3 4V28" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" />
            <circle cx="3" cy="3" r="2" fill="currentColor" />
            <circle cx="3" cy="29" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 3. Chat Input Box (Fello Composer style) */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "16px"
          }} 
          className="w-full p-3 flex flex-col gap-2.5 shadow-xs"
        >
          {/* Attachment preview inside composer */}
          <div className="flex items-center gap-2">
            <img 
              src="/google-icons/docs.webp" 
              className="w-9 h-9 shrink-0 object-contain" 
              alt="Google Docs" 
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[var(--ink)] truncate">IEEE Members</div>
              <div className="text-[8px] text-blue-600 font-bold">Google Doc • 3.2 KB</div>
            </div>
          </div>

          {/* Textarea Input query */}
          <div className="w-full text-xs font-semibold text-[var(--ink)] leading-relaxed px-1 py-1 bg-transparent border-0 outline-none">
            can you add all those people to the organization.
          </div>

          {/* Composer Action buttons */}
          <div className="flex items-center justify-between border-t border-[var(--line)] pt-2 mt-1">
            <button 
              type="button"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--muted)] hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5 stroke-[1.5]" />
            </button>
          </div>
        </div>

        {/* SVG Flow Connector 3 */}
        <div className="h-8 flex items-center justify-center">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300">
            <path d="M3 4V28" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" />
            <circle cx="3" cy="3" r="2" fill="currentColor" />
            <circle cx="3" cy="29" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 4. Tool Calls Box (Real Fello Frontend style) */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "16px"
          }} 
          className="w-full p-4 flex flex-col gap-3 shadow-xs"
        >
          {/* Header */}
          <button
            onClick={() => setToolCallsOpen(!toolCallsOpen)}
            className="flex items-center justify-between w-full text-xs font-bold text-[var(--ink)] hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-[var(--muted)]" />
              <span>20 tool calls executed</span>
            </div>
            <ChevronDown 
              className={cn(
                "w-3.5 h-3.5 text-[var(--muted)] transition-transform duration-200",
                toolCallsOpen ? "rotate-0" : "-rotate-90"
              )} 
            />
          </button>

          {/* Expanded Tool Call details */}
          {toolCallsOpen && (
            <div className="space-y-2 border-t border-[var(--line)] pt-3 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 gap-1.5">
                {toolCalls.map((tool, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      backgroundColor: "var(--paper)", 
                      borderColor: "var(--line)" 
                    }} 
                    className="flex items-center justify-between text-[11px] p-2.5 rounded-lg border font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[var(--ink)] font-bold">{tool.name}</span>
                      <span className="text-[10px] text-[var(--muted)] truncate">({tool.count})</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-[var(--muted)] font-bold shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Success</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SVG Flow Connector 4 */}
        <div className="h-8 flex items-center justify-center">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300">
            <path d="M3 4V28" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" />
            <circle cx="3" cy="3" r="2" fill="currentColor" />
            <circle cx="3" cy="29" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 5. Email Notification Outbox Preview */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "16px"
          }} 
          className="w-full p-4 flex flex-col gap-3.5 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <img 
                src="/google-icons/gmail.webp" 
                className="w-6 h-6 shrink-0 object-contain" 
                alt="Gmail" 
              />
              <div className="text-xs font-bold text-[var(--ink)]">Subject: Invitation to join IEEE</div>
            </div>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Outbox</span>
          </div>

          {/* Email Body */}
          <div 
            style={{ 
              backgroundColor: "var(--paper)", 
              borderColor: "var(--line)" 
            }} 
            className="border rounded-xl p-3.5 space-y-2.5"
          >
            <div className="text-xs text-[var(--ink)] leading-relaxed font-medium">
              Hello Sahanas,<br /><br />
              <span className="font-bold">Kavindu</span> has invited you to the <span className="font-bold">IEEE organization</span>. <br /><br />
              Go to <span className="text-blue-600 underline font-semibold flex inline-flex items-center gap-0.5">app.fello.live <ExternalLink className="w-2.5 h-2.5" /></span> to join the org.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
