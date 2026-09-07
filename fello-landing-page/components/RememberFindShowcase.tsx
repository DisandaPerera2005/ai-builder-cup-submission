"use client";

import React from "react";

export default function RememberFindShowcase() {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-6">

      {/* Left Column: Visual demo */}
      <div className="lg:col-span-6 flex flex-col gap-4 w-full max-w-[480px] lg:justify-self-start justify-self-center order-2 lg:order-1">

        {/* Group chat window */}
        <div
          style={{
            border: "1px solid var(--line-strong)",
            backgroundColor: "#ffffff",
            borderRadius: "16px"
          }}
          className="w-full p-4 overflow-hidden"
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-[var(--line-strong)] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0 select-none">
                <img
                  src="/google-icons/ias-logo.jpg"
                  className="w-8 h-8 rounded-full object-cover border border-[var(--line-strong)]"
                  alt="IAS Logo"
                />
                <img
                  src="/google-icons/whatsapp.svg"
                  className="absolute bottom-0 right-0 size-3 select-none"
                  alt="WhatsApp"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--ink)] leading-none">Industry 360 Team Leads</div>
                <div className="text-[9px] text-[var(--muted)] font-semibold mt-0.5">8 participants</div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider bg-white border border-[var(--line)] px-2 py-0.5 rounded-full">Group Chat</span>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-4">

            {/* Saadath message */}
            <div className="flex items-start gap-3 w-full justify-start">
              <img
                src="/google-icons/faij.jpg"
                className="w-8 h-8 rounded-full object-cover shrink-0 shadow-xs"
                alt="Saadath"
              />
              <div className="flex flex-col items-start max-w-[80%]">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs font-semibold text-neutral-500">Saadath</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed">
                  can I get the project proposal for this event?
                </div>
              </div>
            </div>

            {/* Fello: give me a sec */}
            <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center shrink-0 shadow-xs p-1 select-none">
                <img src="/fello-logo.svg" className="size-full object-contain" alt="Fello" />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs font-semibold text-neutral-500">Fello Agent</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed">
                  Give me a sec ✦
                </div>
              </div>
            </div>

            {/* Fello: drops the document */}
            <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center shrink-0 shadow-xs p-1 select-none">
                <img src="/fello-logo.svg" className="size-full object-contain" alt="Fello" />
              </div>
              <div className="flex flex-col items-end gap-2">
                {/* PDF document card */}
                <div
                  style={{ border: "1px solid var(--line-strong)", borderRadius: "14px" }}
                  className="bg-white p-3 shadow-3xs flex items-center gap-3 min-w-[220px]"
                >
                  <div className="w-10 h-10 bg-neutral-50 border border-[var(--line-strong)] rounded-xl flex items-center justify-center shrink-0 p-1.5">
                    <img src="/google-icons/docs.webp" className="size-full object-contain" alt="Google Docs" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-[var(--ink)] leading-tight">Industry 360 — Project Proposal</div>
                    <div className="text-[9px] text-[var(--muted)] font-semibold mt-0.5">Google Drive • PDF • 2.3 MB</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <img src="/google-icons/drive.png" className="w-3 h-3 object-contain shrink-0" alt="Drive" />
                      <span className="text-[8px] text-neutral-400 font-bold">Synced from Google Drive</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed text-right">
                  Found it — uploaded 3 days ago.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Indexed sources strip */}
        <div className="flex flex-col w-full">
          {[
            { icon: "/google-icons/drive.png",   label: "Google Drive",  sub: "Files indexed in real time" },
            { icon: "/google-icons/docs.webp",   label: "Google Docs",   sub: "Full document content searchable" },
            { icon: "/google-icons/sheets.webp", label: "Google Sheets", sub: "Spreadsheets surfaced instantly" },
            { icon: "/google-icons/slides.webp", label: "Google Slides", sub: "Presentations recalled on ask" },
          ].map((item, idx, arr) => (
            <div
              key={idx}
              className={[
                "border border-[var(--line-strong)] p-3 bg-white flex items-center justify-between shadow-3xs",
                idx === 0 ? "rounded-t-3xl" : "",
                idx === arr.length - 1 ? "rounded-b-3xl" : "border-b-0",
                idx !== 0 && idx !== arr.length - 1 ? "" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 bg-neutral-50 border border-[var(--line-strong)] rounded-full flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                  <img src={item.icon} className="size-full object-contain" alt={item.label} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--ink)] leading-tight">{item.label}</div>
                  <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">{item.sub}</div>
                </div>
              </div>
              <span className="text-[9px] font-bold text-neutral-500 uppercase bg-neutral-50 border border-[var(--line-strong)] px-2 py-0.5 rounded-full select-none shrink-0">Indexed</span>
            </div>
          ))}
        </div>

      </div>

      {/* Right Column: Sticky text (same as CoordinationShowcase) */}
      <div className="lg:col-span-6 flex flex-col justify-start text-left lg:sticky lg:top-28 self-start pt-4 lg:pt-8 pb-4 lg:pb-8 max-w-xs lg:justify-self-center order-1 lg:order-2">
        <span className="section-kicker mb-2">Instant Recall</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          Knows Where Everything Is.
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          Every file, every message, every decision, all indexed and searchable, instantly. No more asking around, no more guessing which folder.
        </p>
      </div>

    </div>
  );
}
