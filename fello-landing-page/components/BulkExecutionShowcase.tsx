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
  Loader2
} from "lucide-react";

export default function BulkExecutionShowcase() {
  const [toolCallsOpen, setToolCallsOpen] = useState(false);

  const toolCalls = [
    { name: "parse_excel_sheet", count: "fired 1 time" },
    { name: "create_whatsapp_group", count: "fired 8 times" },
    { name: "send_contract_email", count: "fired 32 times" },
    { name: "add_whatsapp_group_member", count: "fired 74 times" }
  ];

  const createdTeams = [
    { name: "General Team", count: "32 members" },
    { name: "Secretariat Team", count: "5 members" },
    { name: "Logistics Team", count: "8 members" },
    { name: "Program Team", count: "7 members" },
    { name: "Design Team", count: "6 members" },
    { name: "Finance Team", count: "5 members" }
  ];

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-6">
      
      {/* Left Column: Big Bold Sticky Showcase Text */}
      <div className="lg:col-span-5 flex flex-col justify-start text-left lg:sticky lg:top-28 self-start pt-4 lg:pt-8 pb-4 lg:pb-8 max-w-xs lg:justify-self-center">
        <span className="section-kicker mb-2">Automated Execution</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          40 minutes, down to 2.
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          Drop a spreadsheet of selected volunteers, tell Fello their roles, and let it execute. Fello automatically creates the WhatsApp sub-team groups, drafts contract emails, and maps access roles instantly.
        </p>
      </div>

      {/* Right Column: Visual Mockups Stacked Top to Bottom */}
      <div className="lg:col-span-7 flex flex-col items-center gap-0">
        
        {/* 1. Project Identifier Card (Matching Industry 360 style) */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "9999px"
          }} 
          className="flex items-center justify-between p-2.5 pl-3 pr-5 w-full shadow-3xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-neutral-50 border border-[var(--line-strong)] flex items-center justify-center shrink-0 select-none p-1.5 overflow-hidden">
              <img 
                src="/google-icons/industry-360.svg" 
                className="size-full object-contain" 
                alt="Industry 360 Logo" 
              />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--ink)] leading-none">Industry 360</div>
              <div className="text-[9px] text-[var(--muted)] font-semibold mt-0.5">SLIIT IEEE IAS • Active Project</div>
            </div>
          </div>
          <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider bg-neutral-50 border border-[var(--line-strong)] px-2.5 py-0.5 rounded-full select-none">In Progress</span>
        </div>

        {/* SVG Flow Connector 1 */}
        <div className="h-8 w-full flex flex-col items-center justify-center relative select-none">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300 overflow-visible">
            <path d="M3 0V32" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
            <circle cx="3" cy="0" r="2" fill="currentColor" />
            <circle cx="3" cy="32" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 2. Chat Input Box (Composer with Selected Members Spreadsheet) */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "16px"
          }} 
          className="w-full p-3 flex flex-col gap-2.5 shadow-xs"
        >
          {/* Attachment preview inside composer (Google Sheets) */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white border border-[var(--line-strong)] rounded-lg flex items-center justify-center shrink-0 select-none p-1.5">
              <img src="/google-icons/sheets.webp" className="size-full object-contain" alt="Google Sheets" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[var(--ink)] truncate">Selected members for industry 360</div>
              <div className="text-[8px] text-[var(--muted)] font-bold">Google Sheets • 14.8 KB</div>
            </div>
          </div>

          {/* Input query */}
          <div className="w-full text-xs font-semibold text-[var(--ink)] leading-relaxed px-1 py-1 bg-transparent border-0 outline-none">
            send contract messages on email and add groups on whatsapp based on their roles
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

        {/* SVG Flow Connector 2 */}
        <div className="h-8 w-full flex flex-col items-center justify-center relative select-none">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300 overflow-visible">
            <path d="M3 0V32" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
            <circle cx="3" cy="0" r="2" fill="currentColor" />
            <circle cx="3" cy="32" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 3. Tool Calls Box */}
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
              <span>87 tool calls executed</span>
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

        {/* SVG Flow Connector 3 */}
        <div className="h-8 w-full flex flex-col items-center justify-center relative select-none">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300 overflow-visible">
            <path d="M3 0V32" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
            <circle cx="3" cy="0" r="2" fill="currentColor" />
            <circle cx="3" cy="32" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 4. WhatsApp Teams Dispatch (borderless container) */}
        <div className="w-full flex flex-col gap-3 py-4">
          {/* Panel Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-neutral-50 border border-[var(--line-strong)] flex items-center justify-center shrink-0 select-none p-1.5 overflow-hidden">
                <img 
                  src="/google-icons/industry-360.svg" 
                  className="size-full object-contain" 
                  alt="Industry 360 Logo" 
                />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--ink)] leading-none">WhatsApp Teams Dispatch</div>
                <div className="text-[9px] text-[var(--muted)] font-semibold mt-0.5">8 team groups created autonomously</div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider bg-neutral-50 border border-[var(--line-strong)] px-2.5 py-0.5 rounded-full select-none">WhatsApp</span>
          </div>

          {/* Group items — 2-col grid on md+, 1-col on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
            {[
              { name: "General Team",     count: "32 members" },
              { name: "Team Leads Group", count: "8 members"  },
              { name: "Secretariat Team",  count: "5 members"  },
              { name: "Logistics Team",   count: "8 members"  },
              { name: "Program Team",     count: "7 members"  },
              { name: "Design Team",      count: "6 members"  },
              { name: "Finance Team",     count: "5 members"  },
              { name: "Marketing Team",   count: "6 members"  },
            ].map((team, idx, arr) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isLast = idx === arr.length - 1;
              const isSecondLast = idx === arr.length - 2;
              return (
                <div
                  key={idx}
                  className={[
                    "group/row border border-[var(--line-strong)] p-3 bg-white flex items-center justify-between shadow-3xs rounded-md",
                    isFirst ? "rounded-t-3xl md:rounded-t-md md:rounded-tl-3xl" : "",
                    isSecond ? "md:rounded-tr-3xl" : "",
                    isSecondLast ? "md:rounded-bl-3xl" : "",
                    isLast ? "rounded-b-3xl md:rounded-b-md md:rounded-br-3xl" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0 select-none">
                      <div className="w-7 h-7 bg-neutral-50 border border-[var(--line-strong)] rounded-full flex items-center justify-center p-1.5 overflow-hidden">
                        <img src="/google-icons/industry-360.svg" className="size-full object-contain" alt={team.name} />
                      </div>
                      <img src="/google-icons/whatsapp.svg" className="absolute -bottom-0.5 -right-0.5 size-3.5 select-none" alt="WhatsApp" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--ink)] leading-tight">{team.name}</div>
                      <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">{team.count} • Synchronized</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-500 uppercase bg-neutral-50 border border-[var(--line-strong)] px-2 py-0.5 rounded-full select-none shrink-0">Created</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG Flow Connector 4 */}
        <div className="h-8 w-full flex flex-col items-center justify-center relative select-none">
          <svg width="6" height="32" viewBox="0 0 6 32" fill="none" className="text-neutral-300 overflow-visible">
            <path d="M3 0V32" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
            <circle cx="3" cy="0" r="2" fill="currentColor" />
            <circle cx="3" cy="32" r="2" fill="currentColor" />
          </svg>
        </div>

        {/* 5. Gmail Contracts dispatch outbox */}
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
              <div className="text-xs font-bold text-[var(--ink)]">Subject: Industry 360 Volunteer Contract</div>
            </div>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">32 emails sent</span>
          </div>

          <div 
            style={{ 
              backgroundColor: "var(--paper)", 
              borderColor: "var(--line)" 
            }} 
            className="border rounded-xl p-3.5 space-y-2.5"
          >
            <div className="text-xs text-[var(--ink)] leading-relaxed font-medium">
              Hello [Volunteer Name],<br /><br />
              Congratulations on being selected for the <span className="font-bold">[Team Group]</span> for <span className="font-bold">Industry 360</span>. <br /><br />
              Please review and sign your team contract at <span className="text-blue-600 underline font-semibold flex inline-flex items-center gap-0.5">app.fello.live <ExternalLink className="w-2.5 h-2.5" /></span>.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
