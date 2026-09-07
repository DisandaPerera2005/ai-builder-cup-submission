import * as XLSX from "xlsx"

export interface ParsedMemberRow {
  name: string
  email: string
  phone?: string
}

export interface ParseMemberFileResult {
  rows: ParsedMemberRow[]
  error: string | null
}

function findColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase())
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate)
    if (idx !== -1) return idx
  }
  return -1
}

/**
 * Parse an uploaded CSV or XLSX member-list file into {name, email} rows.
 * Looks for "name"/"full name" and "email"/"email address" header columns
 * (case-insensitive) in the first row; any row without a usable email is
 * dropped rather than failing the whole import.
 */
export async function parseMemberFile(file: File): Promise<ParseMemberFileResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const table = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })

    if (table.length === 0) return { rows: [], error: "The file appears to be empty." }

    const header = (table[0] as unknown[]).map((c) => String(c ?? ""))
    const emailCol = findColumn(header, ["email", "email address", "e-mail"])
    const nameCol = findColumn(header, ["name", "full name", "member name"])
    const phoneCol = findColumn(header, ["phone", "phone number", "whatsapp", "whatsapp number", "mobile"])

    if (emailCol === -1) {
      return { rows: [], error: 'Could not find an "email" column in the file header.' }
    }

    const rows: ParsedMemberRow[] = []
    for (const raw of table.slice(1)) {
      const cells = raw as unknown[]
      const email = String(cells[emailCol] ?? "").trim()
      if (!email || !email.includes("@")) continue
      const name = nameCol !== -1 ? String(cells[nameCol] ?? "").trim() : ""
      const phone = phoneCol !== -1 ? String(cells[phoneCol] ?? "").trim() : ""
      rows.push({ name, email, ...(phone ? { phone } : {}) })
    }

    return { rows, error: null }
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : "Could not read this file." }
  }
}
