"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Compass, Check, Loader2 } from "lucide-react";

export default function CoordinationShowcase() {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-6">
      
      {/* Left Column: Visual Chat Conversation & Dashboard (Across two rooms & project board) */}
      <div className="lg:col-span-6 flex flex-col gap-0 w-full max-w-[480px] lg:justify-self-start justify-self-center order-2 lg:order-1">
        
        {/* Room 1: SLIIT IEEE IAS Excom */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "16px"
          }} 
          className="w-full p-4 overflow-hidden"
        >
          {/* Room Header */}
          <div className="flex items-center justify-between border-b border-[var(--line-strong)] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0 select-none">
                <img 
                  src="/google-icons/ias-logo.jpg" 
                  className="w-8 h-8 rounded-full object-cover border border-[var(--line-strong)]" 
                  alt="SLIIT IEEE IAS Logo" 
                />
                {/* WhatsApp Badge */}
                <img 
                  src="/google-icons/whatsapp.svg" 
                  className="absolute bottom-0 right-0 size-3 select-none" 
                  alt="WhatsApp" 
                />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--ink)] leading-none">SLIIT IEEE IAS Excom</div>
                <div className="text-[9px] text-[var(--muted)] font-semibold mt-0.5">8 participants</div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider bg-white border border-[var(--line)] px-2 py-0.5 rounded-full">Group Chat</span>
          </div>

          {/* Conversation Thread */}
          <div className="flex flex-col gap-4">
            
            {/* Saadath Message */}
            <div className="flex items-start gap-3 w-full justify-start">
              <img 
                src="/profile.jpg" 
                className="w-8 h-8 rounded-full object-cover shrink-0 shadow-xs" 
                alt="Saadath" 
              />
              <div className="flex flex-col items-start max-w-[80%]">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-500 font-normal">Saadath</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-400 font-normal">Vice Chairperson</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed">
                  Hi guys, we have to organize a new event, "Industry 360".
                </div>
              </div>
            </div>

            {/* Fello Agent Response */}
            <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
              {/* Fello Logo Outline bg-white */}
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center shrink-0 shadow-xs p-1 select-none">
                <img src="/fello-logo.svg" className="size-full object-contain" alt="Fello Logo" />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-400 font-normal">AI Coordinator</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-500 font-normal">Fello Agent</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed text-right">
                  That's great, I created an event called "Industry 360". Do you have a logo or shall we create one?
                </div>
              </div>
            </div>

            {/* Saadath Message 2 */}
            <div className="flex items-start gap-3 w-full justify-start">
              <img 
                src="/profile.jpg" 
                className="w-8 h-8 rounded-full object-cover shrink-0 shadow-xs" 
                alt="Saadath" 
              />
              <div className="flex flex-col items-start max-w-[80%]">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-500 font-normal">Saadath</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-400 font-normal">Vice Chairperson</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed">
                  No, we need to create a logo for that.
                </div>
              </div>
            </div>

            {/* Fello Agent Response 2 */}
            <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
              {/* Fello Logo Outline bg-white */}
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center shrink-0 shadow-xs p-1 select-none">
                <img src="/fello-logo.svg" className="size-full object-contain" alt="Fello Logo" />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-400 font-normal">AI Coordinator</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-500 font-normal">Fello Agent</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed text-right">
                  Created task "Design the logo." When's it due?
                </div>
              </div>
            </div>

            {/* Saadath Message 3 */}
            <div className="flex items-start gap-3 w-full justify-start">
              <img 
                src="/profile.jpg" 
                className="w-8 h-8 rounded-full object-cover shrink-0 shadow-xs" 
                alt="Saadath" 
              />
              <div className="flex flex-col items-start max-w-[80%]">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-500 font-normal">Saadath</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-400 font-normal">Vice Chairperson</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed">
                  How about next Monday?
                </div>
              </div>
            </div>

            {/* Fello Agent Response 3 */}
            <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
              {/* Fello Logo Outline bg-white */}
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center shrink-0 shadow-xs p-1 select-none">
                <img src="/fello-logo.svg" className="size-full object-contain" alt="Fello Logo" />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-400 font-normal">AI Coordinator</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-500 font-normal">Fello Agent</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed text-right">
                  Got it — sending it to the design team now with a Monday deadline.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Dashed Connecting Connector representing autonomous context switch */}
        <div className="h-16 w-full flex flex-col items-center justify-center relative select-none">
          <svg width="6" height="64" viewBox="0 0 6 64" fill="none" className="text-neutral-300 overflow-visible">
            <path d="M3 0V64" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
            <circle cx="3" cy="0" r="2" fill="currentColor" />
            <circle cx="3" cy="32" r="2.5" className="fill-neutral-400 animate-pulse" />
            <circle cx="3" cy="64" r="2" fill="currentColor" />
          </svg>
          <span style={{ border: "1px solid var(--line-strong)", backgroundColor: "#ffffff" }} className="absolute text-[8px] font-bold text-neutral-500 uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-3xs flex items-center gap-1 select-none">
            <Compass className="w-2.5 h-2.5 text-neutral-400 animate-spin [animation-duration:10s]" />
            <span>Agent Autonomously Dispatches to Design Team</span>
          </span>
        </div>

        {/* Room 2: IAS Design Team */}
        <div 
          style={{ 
            border: "1px solid var(--line-strong)", 
            backgroundColor: "#ffffff",
            borderRadius: "16px"
          }} 
          className="w-full p-4 overflow-hidden"
        >
          {/* Room Header */}
          <div className="flex items-center justify-between border-b border-[var(--line-strong)] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0 select-none">
                <img 
                  src="/google-icons/ias-logo.jpg" 
                  className="w-8 h-8 rounded-full object-cover border border-[var(--line-strong)]" 
                  alt="SLIIT IEEE IAS Logo" 
                />
                {/* WhatsApp Badge */}
                <img 
                  src="/google-icons/whatsapp.svg" 
                  className="absolute bottom-0 right-0 size-3 select-none" 
                  alt="WhatsApp" 
                />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--ink)] leading-none">IAS Design Team</div>
                <div className="text-[9px] text-[var(--muted)] font-semibold mt-0.5">5 participants</div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider bg-white border border-[var(--line)] px-2 py-0.5 rounded-full">Group Chat</span>
          </div>

          {/* Conversation Thread */}
          <div className="flex flex-col gap-4">
            
            {/* Fello Agent Broadcast */}
            <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
              {/* Fello Logo Outline bg-white */}
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center shrink-0 shadow-xs p-1 select-none">
                <img src="/fello-logo.svg" className="size-full object-contain" alt="Fello Logo" />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-400 font-normal">AI Coordinator</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-500 font-normal">Fello Agent</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed text-right">
                  Hey team, Industry 360 needs a logo by Monday. Anyone free to take it on?
                </div>
              </div>
            </div>

            {/* Faij Message */}
            <div className="flex items-start gap-3 w-full justify-start">
              <img 
                src="/google-icons/faij.jpg" 
                className="w-8 h-8 rounded-full object-cover shrink-0 shadow-xs" 
                alt="Faij" 
              />
              <div className="flex flex-col items-start max-w-[80%]">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-500 font-normal">Faij</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-400 font-normal">Designer</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed">
                  I can do it.
                </div>
              </div>
            </div>

            {/* Fello Agent Confirmation */}
            <div className="flex items-start gap-3 max-w-[80%] self-end flex-row-reverse">
              {/* Fello Logo Outline bg-white */}
              <div className="w-8 h-8 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center shrink-0 shadow-xs p-1 select-none">
                <img src="/fello-logo.svg" className="size-full object-contain" alt="Fello Logo" />
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                  <span className="text-xs text-neutral-400 font-normal">AI Coordinator</span>
                  <span className="text-xs text-neutral-400 font-normal">•</span>
                  <span className="text-xs text-neutral-500 font-normal">Fello Agent</span>
                </div>
                <div className="bg-white border border-[var(--line-strong)] rounded-2xl p-3 shadow-3xs text-xs text-[var(--ink)] font-normal leading-relaxed text-right">
                  Great, assigning it to you — due Monday. I'll let Saadath know.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Dashed Connecting Connector representing project status update in dashboard */}
        <div className="h-16 w-full flex flex-col items-center justify-center relative select-none">
          <svg width="6" height="64" viewBox="0 0 6 64" fill="none" className="text-neutral-300 overflow-visible">
            <path d="M3 0V64" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
            <circle cx="3" cy="0" r="2" fill="currentColor" />
            <circle cx="3" cy="32" r="2.5" className="fill-neutral-400 animate-pulse" />
            <circle cx="3" cy="64" r="2" fill="currentColor" />
          </svg>
          <span style={{ border: "1px solid var(--line-strong)", backgroundColor: "#ffffff" }} className="absolute text-[8px] font-bold text-neutral-500 uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-3xs flex items-center gap-1 select-none">
            <Compass className="w-2.5 h-2.5 text-neutral-400 animate-spin [animation-duration:10s]" />
            <span>Task Logged Autonomously in Project Workspace</span>
          </span>
        </div>

        {/* Room 3: Fello Project Dashboard representation */}
        <div className="w-full flex flex-col">
          {/* Project Header (enclosed in its own rounded-full bordered card) */}
          <div 
            style={{ 
              border: "1px solid var(--line-strong)", 
              backgroundColor: "#ffffff",
              borderRadius: "9999px"
            }} 
            className="flex items-center justify-between p-2.5 pl-3 pr-5 w-full mb-4 shadow-3xs"
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

          {/* Project Task List matching fello-frontend RoundedList/RoundedListItem style exactly */}
          <div className="flex flex-col space-y-3 w-full">
            
            {/* Task 1: Design the Logo (Completed by Faij) */}
            <div className="group/row border border-[var(--line-strong)] p-3 rounded-md first:rounded-t-3xl last:rounded-b-3xl bg-white flex items-center justify-between shadow-3xs mx-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-4.5 h-4.5 rounded-full bg-neutral-50 border border-neutral-300 flex items-center justify-center text-neutral-600 shrink-0">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--ink)] leading-tight">Design the logo</div>
                  <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">Assigned to Faij • Completed</div>
                </div>
              </div>
              <img 
                src="/google-icons/faij.jpg" 
                className="w-6 h-6 rounded-full border border-[var(--line-strong)] object-cover shrink-0 select-none" 
                alt="Faij" 
              />
            </div>

            {/* Task 2: Organize event logistics (Completed by Saadath) */}
            <div className="group/row border border-[var(--line-strong)] p-3 rounded-md first:rounded-t-3xl last:rounded-b-3xl bg-white flex items-center justify-between shadow-3xs mx-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-4.5 h-4.5 rounded-full bg-neutral-50 border border-neutral-300 flex items-center justify-center text-neutral-600 shrink-0">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--ink)] leading-tight">Organize event logistics</div>
                  <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">Assigned to Saadath • Completed</div>
                </div>
              </div>
              <img 
                src="/profile.jpg" 
                className="w-6 h-6 rounded-full border border-[var(--line-strong)] object-cover shrink-0 select-none" 
                alt="Saadath" 
              />
            </div>

            {/* Task 3: Create the Google Form for volunteer registrations (In Progress by Fello Agent) */}
            <div className="group/row border border-[var(--line-strong)] p-3 rounded-md first:rounded-t-3xl last:rounded-b-3xl bg-white flex items-center justify-between shadow-3xs mx-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Loader2 className="w-4.5 h-4.5 text-neutral-400 animate-spin shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--ink)] leading-tight">Create the Google Form for volunteer registrations</div>
                  <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">Assigned to Fello Agent • Pending</div>
                </div>
              </div>
              <div className="w-6 h-6 rounded-full bg-white border border-[var(--line-strong)] flex items-center justify-center p-0.5 shrink-0 select-none">
                <img 
                  src="/fello-logo.svg" 
                  className="size-full object-contain" 
                  alt="Fello Logo" 
                />
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Right Column: Big Bold Showcase Text */}
      <div className="lg:col-span-6 flex flex-col justify-start text-left lg:sticky lg:top-28 self-start pt-4 lg:pt-8 pb-4 lg:pb-8 max-w-xs lg:justify-self-center order-1 lg:order-2">
        <span className="section-kicker mb-2">Autonomous Coordination</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          Acts on its own.
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          Say it once in the group, and Fello takes it from there. It creates the task, sends it to the right team, and follows up so you don't have to.
        </p>
      </div>

    </div>
  );
}
