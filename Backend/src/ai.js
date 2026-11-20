const CATEGORY_RULES = [
  { category: "Infrastructure", terms: ["classroom", "building", "ceiling", "roof", "door", "furniture", "wall", "lift", "elevator"] },
  { category: "Electrical", terms: ["electric", "power", "light", "fan", "wire", "wiring", "socket", "outlet", "wifi", "wi-fi", "internet", "network", "not working"] },
  { category: "Cleanliness", terms: ["clean", "dirty", "garbage", "trash", "toilet", "washroom", "hygiene", "pest"] },
  { category: "Hostel", terms: ["hostel", "dorm", "residence", "room", "warden"] },
  { category: "Academic", terms: ["lecture", "faculty", "professor", "class", "exam", "course", "timetable", "assignment"] },
  { category: "Transport", terms: ["bus", "transport", "shuttle", "parking", "traffic"] },
  { category: "Safety", terms: ["safety", "unsafe", "harassment", "security", "emergency", "fire", "theft"] },
  { category: "Other", terms: [] }
];

function classifyComplaint(description) {
  const text = description.toLowerCase();
  let best = { category: "Other", score: 0 };
  for (const rule of CATEGORY_RULES) {
    const score = rule.terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    if (score > best.score) best = { category: rule.category, score };
  }
  return best.category;
}

function summarizeComplaint(description) {
  const sentence = description.trim().split(/(?<=[.!?])\s+/)[0];
  if (sentence.length <= 160) return sentence;
  return `${sentence.slice(0, 157).trimEnd()}...`;
}

function suggestPriority(description) {
  const text = description.toLowerCase();
  if (/\b(emergency|urgent|danger|unsafe|fire|injury|harassment|exposed wire|sparking)\b/.test(text)) return "High";
  if (/\b(broken|not working|leak|outage|unusable|repeated|blocked)\b/.test(text)) return "Medium";
  return "Low";
}

function analyzeComplaint(description) {
  return {
    category: classifyComplaint(description),
    summary: summarizeComplaint(description),
    priority: suggestPriority(description)
  };
}

module.exports = { analyzeComplaint, classifyComplaint, summarizeComplaint, suggestPriority };
