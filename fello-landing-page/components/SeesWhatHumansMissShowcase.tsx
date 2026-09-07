"use client"

import { GoInfo } from "react-icons/go";



import React from "react"

export default function SeesWhatHumansMissShowcase() {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-6">

      {/* Left Column: Sticky explanatory text */}
      <div className="lg:col-span-5 flex flex-col justify-start text-left lg:sticky lg:top-28 self-start pt-4 lg:pt-8 pb-4 lg:pb-8 max-w-xs lg:justify-self-center">
        <span className="section-kicker mb-2">Silent Insight</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          Sees What Humans Miss
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          A deadline about to slip. Fello catches it before anyone has to and already has a fix ready
        </p>
      </div>

      {/* Right Column: Quiet visual with task bars */}
      <div className="lg:col-span-7 flex flex-col items-center gap-6">
        {/* Member bars */}
        <div className="w-full max-w-[480px] space-y-4">
          {/* Faij */}
          <div className="flex items-center gap-3">
            <img src="/google-icons/faij.jpg" alt="Faij" className="w-10 h-10 rounded-full object-cover border border-[var(--line-strong)]" />
            <div className="flex-1">
              <div className="flex justify-between text-xs font-medium text-[var(--ink)] mb-1">
                <span>Faij</span>
                <span>3 open tasks</span>
              </div>
              <div className="h-3 bg-neutral-200 rounded-full overflow-hidden">
                <div className="h-3 bg-neutral-500 w-3/4" /> {/* 3 out of 4 (max) */}
              </div>
            </div>
          </div>
          {/* Real suggestion alert */}
          <div className="flex items-start gap-3 bg-neutral-100 border border-[var(--line-strong)] p-4 rounded-2xl">
            <GoInfo className="text-neutral-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1 text-[var(--muted)] text-sm">
              <p className="mb-1"><strong>Faij</strong> has 3 open tasks on Industry 360, all due by Thursday. At this pace, one of them's likely to slip.</p>
              <button className="mt-1 text-[var(--ink)] font-medium underline">Want me to move one to someone else?</button>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
