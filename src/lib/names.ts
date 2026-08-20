// Students are stored by first name plus a short piece of their last name, so
// the app never keeps a full legal name. One letter is used by default and it
// grows to two or three only when that is what tells two students apart
// (for example "Maya Ch" and "Maya Ce").

export const MAX_LAST_LETTERS = 3;

export type ParsedName = { first: string; last: string };

// Names pasted from a spreadsheet are often shouted in capitals.
function tidy(word: string) {
  if (!word) return "";
  return word === word.toUpperCase()
    ? word[0] + word.slice(1).toLowerCase()
    : word;
}

// "Avery Johnson" and "Johnson, Avery" both mean the same student.
export function parseName(raw: string): ParsedName {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { first: "", last: "" };
  const [surname, given] = text.includes(",")
    ? text.split(",").map((part) => part.trim())
    : [null, text];
  if (surname !== null)
    return { first: tidy(given ?? ""), last: tidy(surname) };
  const parts = (given ?? "").split(" ");
  const first = parts.shift() ?? "";
  return { first: tidy(first), last: tidy(parts.pop() ?? "") };
}

export function shortenName({ first, last }: ParsedName, letters = 1) {
  const initials = last.slice(0, Math.min(letters, MAX_LAST_LETTERS));
  return initials ? `${first} ${initials}` : first;
}

// Turns a list of typed names into the short names we store, lengthening the
// last-name piece only where two students would otherwise look identical.
export function shortenRoster(rawNames: string[], taken: string[] = []) {
  const parsed = rawNames.map(parseName).filter((name) => name.first);
  const letters = parsed.map(() => 1);

  for (let round = 1; round < MAX_LAST_LETTERS; round++) {
    const counts = new Map<string, number>();
    const tally = (name: string) =>
      counts.set(name, (counts.get(name) ?? 0) + 1);
    taken.forEach(tally);
    parsed.forEach((name, index) => tally(shortenName(name, letters[index])));

    let grew = false;
    parsed.forEach((name, index) => {
      const clashes = (counts.get(shortenName(name, letters[index])) ?? 0) > 1;
      if (clashes && name.last.length > letters[index]) {
        letters[index]++;
        grew = true;
      }
    });
    if (!grew) break;
  }

  return parsed.map((name, index) => shortenName(name, letters[index]));
}

// A pasted roster is one name per line, or a single line of comma-separated
// names. Commas inside a multi-line paste mean "Last, First".
export function splitNames(text: string) {
  const lines = text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const names = lines.length > 1 ? lines : (lines[0] ?? "").split(",");
  return names.map((name) => name.trim()).filter(Boolean);
}

function splitRow(line: string) {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

// Pulls names out of a spreadsheet export. Separate first-name and last-name
// columns are joined back together; anything else uses the first column.
export function csvToNames(text: string) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(splitRow);
  if (!rows.length) return [];
  const header = rows[0].map((cell) => cell.toLowerCase());
  const firstColumn = header.findIndex((cell) => cell.includes("first"));
  const lastColumn = header.findIndex((cell) =>
    /last|surname|family/.test(cell),
  );
  if (firstColumn >= 0)
    return rows
      .slice(1)
      .map((row) =>
        `${row[firstColumn] ?? ""} ${lastColumn >= 0 ? (row[lastColumn] ?? "") : ""}`.trim(),
      )
      .filter(Boolean);
  const hasHeader = /name|student/.test(header[0] ?? "");
  return rows
    .slice(hasHeader ? 1 : 0)
    .map((row) => row[0])
    .filter(Boolean);
}
