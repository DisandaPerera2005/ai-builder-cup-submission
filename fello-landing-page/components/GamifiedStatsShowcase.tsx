"use client";

import React, { useState, useEffect } from "react";
import { GoCheckCircle } from "react-icons/go";

const DEFAULT_TEAMS = [
  {
    teamName: "Finance Team",
    kicker: "Budget Secured",
    notice: "Finance Team secured $5,500 of $6,500 (85%) for Industry 360 across 42 logged outreach calls.",
    totalProgress: 85,
    totalLabel: "$5,500 / $6,500 (85%)",
    members: [
      { initial: "S", name: "Sahanas", stat: "$3,200 secured", progressWidth: "w-4/5", fillBg: "bg-neutral-600" },
      { initial: "S", name: "Saadath", stat: "$1,500 secured", progressWidth: "w-3/5", fillBg: "bg-neutral-500" },
      { initial: "V", name: "Vishara", stat: "$800 secured", progressWidth: "w-2/5", fillBg: "bg-neutral-400" },
    ],
  },
  {
    teamName: "Design Team",
    kicker: "Flyer Delivery Rate",
    notice: "Design Team completed 13 flyers with a 92% on-time delivery rate for Industry 360.",
    totalProgress: 92,
    totalLabel: "92% On-Time Delivery",
    members: [
      { initial: "F", name: "Faij", stat: "6 flyers took • 100% on time", progressWidth: "w-full", fillBg: "bg-neutral-600" },
      { initial: "A", name: "Aneeshvara", stat: "4 flyers took • 75% on time", progressWidth: "w-3/4", fillBg: "bg-neutral-500" },
      { initial: "S", name: "Shafkhan", stat: "3 flyers took • 100% on time", progressWidth: "w-full", fillBg: "bg-neutral-600" },
    ],
  },
  {
    teamName: "Program Team",
    kicker: "Speaker Outreach",
    notice: "Program Team reached out to 18 speakers with 12 confirmed keynotes for Industry 360.",
    totalProgress: 67,
    totalLabel: "12 / 18 Confirmed (67%)",
    members: [
      { initial: "C", name: "Chathumina", stat: "8 speakers reached • 5 confirmed", progressWidth: "w-3/5", fillBg: "bg-neutral-600" },
      { initial: "V", name: "Vihara", stat: "6 speakers reached • 4 confirmed", progressWidth: "w-2/3", fillBg: "bg-neutral-500" },
      { initial: "S", name: "Sahanas", stat: "4 speakers reached • 3 confirmed", progressWidth: "w-3/4", fillBg: "bg-neutral-500" },
    ],
  },
];

export default function GamifiedStatsShowcase() {
  const [activeTab, setActiveTab] = useState(0); // 0: Finance, 1: Design, 2: Program
  const [isPaused, setIsPaused] = useState(false);
  const [teamData, setTeamData] = useState(DEFAULT_TEAMS);

  useEffect(() => {
    // Optionally fetch dynamic telemetry from Cloud Run backend if API is configured
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (backendUrl) {
      fetch(`${backendUrl.replace(/\/$/, "")}/orgs/demo/stats`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && data?.stats?.teams) {
            setTeamData(data.stats.teams);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % teamData.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, teamData.length]);

  const currentTeam = teamData[activeTab] || teamData[0];


  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-6">
      
      {/* Left Column: Stacked list matching Google Drive / Docs list in RememberFindShowcase */}
      <div className="lg:col-span-7 flex flex-col items-center gap-6 order-2 lg:order-1">
        <div 
          className="w-full max-w-[480px] space-y-4"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          
          {/* Active Team Kicker */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-[var(--muted)]">
              <strong className="text-[var(--ink)]">{currentTeam.teamName}</strong> • {currentTeam.kicker}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center gap-1 select-none shrink-0">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>

          {/* Member Stacked List (exact same rounded-t-3xl rounded-b-3xl border-b-0 list structure as Google Drive list) */}
          <div className="flex flex-col w-full">
            {currentTeam.members.map((member, idx, arr) => (
              <div
                key={idx}
                className={[
                  "border border-[var(--line-strong)] p-3 bg-white flex items-center gap-3 shadow-3xs",
                  idx === 0 ? "rounded-t-3xl" : "",
                  idx === arr.length - 1 ? "rounded-b-3xl" : "border-b-0",
                ].join(" ")}
              >
                {/* Faij style avatar badge */}
                <div className="w-10 h-10 rounded-full bg-neutral-50 border border-[var(--line-strong)] flex items-center justify-center font-bold text-xs text-[var(--ink)] shrink-0 select-none">
                  {member.initial}
                </div>
                {/* Faij style name, stat & progress bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs font-medium text-[var(--ink)] mb-1">
                    <span>{member.name}</span>
                    <span>{member.stat}</span>
                  </div>
                  <div className="h-3 bg-neutral-200 rounded-full overflow-hidden">
                    <div className={`h-3 ${member.fillBg} ${member.progressWidth}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Real Suggestion / Insight Alert Box (Matching SeesWhatHumansMissShowcase) */}
          <div className="flex items-start gap-3 bg-neutral-100 border border-[var(--line-strong)] p-4 rounded-2xl">
            <GoCheckCircle className="text-neutral-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1 text-[var(--muted)] text-sm">
              <p className="mb-2">
                <strong>{currentTeam.teamName}</strong> — {currentTeam.notice}
              </p>

              {/* Total Progress inside notice */}
              <div className="pt-2 border-t border-[var(--line-strong)] mt-2">
                <div className="flex justify-between text-xs font-medium text-[var(--ink)] mb-1">
                  <span>Total Team Progress</span>
                  <span>{currentTeam.totalLabel}</span>
                </div>
                <div className="h-3 bg-neutral-200 rounded-full overflow-hidden">
                  <div 
                    className="h-3 bg-neutral-600 transition-all duration-300"
                    style={{ width: `${currentTeam.totalProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3 Pagination Dots at Bottom */}
          <div className="flex items-center justify-center gap-2 pt-1 select-none">
            {teamData.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                aria-label={`Switch to ${teamData[i].teamName}`}
                className={`transition-all duration-200 rounded-full cursor-pointer ${
                  activeTab === i 
                    ? "w-6 h-2 bg-neutral-800" 
                    : "w-2 h-2 bg-neutral-300 hover:bg-neutral-400"
                }`}
              />
            ))}
          </div>

        </div>
      </div>

      {/* Right Column: Sticky text */}
      <div className="lg:col-span-5 flex flex-col justify-start text-left lg:sticky lg:top-28 self-start pt-4 lg:pt-8 pb-4 lg:pb-8 max-w-xs lg:justify-self-center order-1 lg:order-2">
        <span className="section-kicker mb-2">Automated Gamification</span>
        <h2 className="text-[var(--ink)] font-bold tracking-tight leading-snug mb-3 text-2xl md:text-3xl">
          Gamify Team Progress.
        </h2>
        <p className="text-[var(--muted)] font-medium text-xs md:text-sm leading-relaxed">
          Volunteering is a space where motivation can dry faster than water on hot asphalt. By automatically tracking secured budget, flyer turnarounds, and speaker outreach directly from WhatsApp, Fello gamifies everyday coordination so effort never goes unnoticed.
        </p>
      </div>

    </div>
  );
}
