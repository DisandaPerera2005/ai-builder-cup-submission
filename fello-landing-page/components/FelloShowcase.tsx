"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Users, 
  ChevronRight, 
  Plus, 
  CheckSquare, 
  FileText,
  UserCheck
} from "lucide-react";

// Mock types matching fello-frontend exactly
interface MemberItem {
  name: string;
  role?: string;
  status?: "active" | "pending" | "inactive";
}

interface EventSummary {
  name: string;
  date?: string;
  status?: "active" | "closed" | "draft";
  progress?: number;
  tasksDone?: number;
  tasksTotal?: number;
  coordinators?: string[];
  eventType?: string;
}

export default function FelloShowcase() {
  const [activeTab, setActiveTab] = useState<"projects" | "members">("projects");

  const members: MemberItem[] = [
    { name: "Kavindu Udhara", role: "IEEE General Chair", status: "active" },
    { name: "Sahanas Rajapakse", role: "Outreach Chairperson", status: "active" },
    { name: "Shafkhan Ameer", role: "logistics Coordinator", status: "active" },
    { name: "Dilshan Perera", role: "Design Lead", status: "active" },
    { name: "Vishara Fernando", role: "Publicity Officer", status: "pending" },
    { name: "Aneeshvara de Silva", role: "Secretary", status: "inactive" }
  ];

  const events: EventSummary[] = [
    {
      name: "Parents-Teachers Interaction (PTI 2026)",
      date: "July 12, 2026",
      status: "active",
      eventType: "Chapter Chapter",
      tasksDone: 7,
      tasksTotal: 10,
      coordinators: ["Kavindu Udhara", "Shafkhan Ameer"]
    },
    {
      name: "IEEE Extreme Hackathon",
      date: "October 24, 2026",
      status: "draft",
      eventType: "Competition",
      tasksDone: 0,
      tasksTotal: 15,
      coordinators: ["Dilshan Perera"]
    },
    {
      name: "Annual General Meeting (AGM)",
      date: "January 15, 2026",
      status: "closed",
      eventType: "Administrative",
      tasksDone: 12,
      tasksTotal: 12,
      coordinators: ["Kavindu Udhara", "Aneeshvara de Silva"]
    }
  ];

  const ini = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: "0.5rem",
        borderBottom: "1px solid var(--line-strong)",
        paddingBottom: "0.5rem"
      }}>
        <button
          onClick={() => setActiveTab("projects")}
          style={{
            background: "none",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: activeTab === "projects" ? "var(--ink)" : "var(--muted)",
            borderBottom: activeTab === "projects" ? "2px solid var(--ink)" : "none",
            cursor: "pointer"
          }}
        >
          Project Components
        </button>
        <button
          onClick={() => setActiveTab("members")}
          style={{
            background: "none",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: activeTab === "members" ? "var(--ink)" : "var(--muted)",
            borderBottom: activeTab === "members" ? "2px solid var(--ink)" : "none",
            cursor: "pointer"
          }}
        >
          Member Components
        </button>
      </div>

      {/* Rendering Real Components from fello-frontend */}
      <div style={{ minHeight: "340px" }}>
        {activeTab === "projects" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Event List Block (real UI recreation) */}
            <div style={{
              borderRadius: "16px",
              border: "1px solid var(--line-strong)",
              backgroundColor: "var(--paper-soft)",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(16,16,18,0.02)"
            }}>
              <div style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--line)",
                fontWeight: 800,
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--muted)"
              }}>
                Events Overview
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {events.map((ev, i) => {
                  const pct = ev.tasksTotal ? Math.round((ev.tasksDone ?? 0) / ev.tasksTotal * 100) : 0;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem",
                        borderBottom: i < events.length - 1 ? "1px solid var(--line)" : "none",
                        transition: "background-color 0.2s"
                      }}
                      className="showcase-hover-row"
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--ink)" }}>{ev.name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Calendar size={12} /> {ev.date}
                        </div>
                        {pct !== undefined && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
                            <div style={{ width: "80px", height: "4px", backgroundColor: "rgba(16,16,18,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: ev.status === "active" ? "var(--green)" : "var(--muted)" }} />
                            </div>
                            <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{pct}%</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                          {ev.tasksDone}/{ev.tasksTotal} tasks
                        </span>
                        <span style={{
                          fontSize: "0.65rem",
                          fontWeight: 800,
                          padding: "0.2rem 0.5rem",
                          borderRadius: "99px",
                          backgroundColor: ev.status === "active" ? "var(--green-soft)" : "rgba(16, 16, 18, 0.05)",
                          color: ev.status === "active" ? "var(--green)" : "var(--muted)",
                          textTransform: "capitalize"
                        }}>
                          {ev.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Details Card Block (real UI recreation) */}
            <div style={{
              borderRadius: "16px",
              border: "1px solid var(--line-strong)",
              backgroundColor: "var(--paper-soft)",
              padding: "1.25rem",
              boxShadow: "0 4px 12px rgba(16,16,18,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--ink)" }}>
                    {events[0].name}
                  </h4>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <Calendar size={13} /> {events[0].date}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 800, border: "1px solid var(--line-strong)", padding: "0.2rem 0.5rem", borderRadius: "6px" }}>
                    {events[0].eventType}
                  </span>
                  <span style={{ fontSize: "0.65rem", fontWeight: 800, backgroundColor: "var(--green-soft)", color: "var(--green)", padding: "0.2rem 0.5rem", borderRadius: "99px" }}>
                    {events[0].status}
                  </span>
                </div>
              </div>

              {/* Progress Slider */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                  <span>Tasks Completed</span>
                  <span>{events[0].tasksDone} / {events[0].tasksTotal} Completed</span>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(16,16,18,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: "70%", height: "100%", backgroundColor: "var(--green)" }} />
                </div>
              </div>

              {/* Coordinators */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Users size={14} color="var(--muted)" />
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  {events[0].coordinators?.map((c, i) => (
                    <span key={i} style={{ fontSize: "0.65rem", backgroundColor: "rgba(16, 16, 18, 0.05)", padding: "0.15rem 0.5rem", borderRadius: "99px", color: "var(--ink)", fontWeight: 700 }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                borderTop: "1px solid var(--line)",
                marginTop: "1.25rem",
                paddingTop: "0.75rem",
                display: "flex",
                gap: "0.5rem"
              }}>
                <button style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  padding: "0.4rem 0",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--muted)",
                  cursor: "pointer",
                  borderRadius: "6px",
                  transition: "background-color 0.2s"
                }} className="btn-action-hover">
                  View Tasks
                </button>
                <div style={{ width: "1px", height: "20px", backgroundColor: "var(--line-strong)", alignSelf: "center" }} />
                <button style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  padding: "0.4rem 0",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--muted)",
                  cursor: "pointer",
                  borderRadius: "6px",
                  transition: "background-color 0.2s"
                }} className="btn-action-hover">
                  View Team
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Member Grid Block (real UI recreation) */
          <div style={{
            borderRadius: "16px",
            border: "1px solid var(--line-strong)",
            backgroundColor: "var(--paper-soft)",
            padding: "1.25rem",
            boxShadow: "0 4px 12px rgba(16,16,18,0.02)"
          }}>
            <div style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "1rem"
            }}>
              Team Members Directory
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem"
            }}>
              {members.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    backgroundColor: "#ffffff",
                    padding: "0.6rem 0.8rem",
                    transition: "all 0.2s"
                  }}
                  className="showcase-hover-row"
                >
                  {/* Avatar fallback */}
                  <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(37, 99, 235, 0.08)",
                    color: "var(--blue)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    flexShrink: 0
                  }}>
                    {ini(m.name)}
                  </div>
                  
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </div>
                    {m.role && (
                      <div style={{ fontSize: "0.65rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "0.1rem" }}>
                        {m.role}
                      </div>
                    )}
                  </div>

                  {/* Status Dot */}
                  {m.status && (
                    <span style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: m.status === "active" ? "var(--green)" : m.status === "pending" ? "#eab308" : "rgba(16,16,18,0.15)",
                      flexShrink: 0
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
