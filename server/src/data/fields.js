/**
 * The JV listing record schema. Field keys are stable identifiers stored in the
 * database; labels are what users see. Roles drive sections, actions and filters.
 */
export const FIELDS = [
  { key: 'feasibility_made_by', label: 'Feasibility Made By', role: 'feasibility' },
  { key: 'jv_id', label: 'JV ID', role: 'jvId', required: true },
  { key: 'updated_by', label: 'Updated By', role: 'updatedBy' },
  { key: 'rea_no', label: 'REA No', role: 'phone', type: 'phone' },
  { key: 'ratings', label: 'Ratings', role: 'rating' },
  { key: 'google_pin', label: 'Google Pin', role: 'mapLink', type: 'url' },
  { key: 'location', label: 'Location', role: 'location', multiline: true },
  { key: 'area', label: 'Area', role: 'area', placeholder: 'e.g. 2 Acres 10 Guntas' },
  { key: 'road_width', label: 'Road Width', role: 'road' },
  { key: 'goodwill', label: 'Goodwill', role: 'goodwill' },
  { key: 'sharing', label: 'Sharing', role: 'sharing', placeholder: 'e.g. 60:40' },
  { key: 'loi_sent_or_not', label: 'LOI Sent or Not', role: 'loi' },
  { key: 'mou', label: 'MOU', role: 'mou' },
  { key: 'jda_llp', label: 'JDA/LLP', role: 'jda' },
  { key: 'status', label: 'Status', role: 'status' },
  { key: 'notes', label: 'Notes', role: 'notes', multiline: true },
];

export const FIELD_KEYS = new Set(FIELDS.map((f) => f.key));

export const SECTIONS = [
  { id: 'overview', title: 'Overview', roles: ['jvId', 'feasibility', 'rating', 'status'] },
  { id: 'contact', title: 'Source & Contact', roles: ['updatedBy', 'phone'] },
  { id: 'property', title: 'Property', roles: ['location', 'mapLink', 'area', 'road'] },
  { id: 'commercials', title: 'Commercials', roles: ['goodwill', 'sharing'] },
  { id: 'documents', title: 'Deal Documents & Progress', roles: ['loi', 'mou', 'jda'] },
  { id: 'notes', title: 'Notes', roles: ['notes'] },
];

/** Header aliases used when importing CSV files (e.g. an export of the old spreadsheet). */
export const IMPORT_RULES = [
  ['jv_id', /\bjv\s*id\b|^id$/i],
  ['feasibility_made_by', /feasibility/i],
  ['updated_by', /updated\s*by/i],
  ['rea_no', /\brea\s*no\b|phone|mobile|contact\s*(no|number)/i],
  ['ratings', /rating/i],
  ['google_pin', /google\s*pin|\bmap\b|\bpin\b/i],
  ['location', /^location$|address|village/i],
  ['area', /^area$|extent/i],
  ['road_width', /road/i],
  ['goodwill', /goodwill/i],
  ['sharing', /sharing|ratio/i],
  ['loi_sent_or_not', /\bloi\b/i],
  ['mou', /\bmou\b/i],
  ['jda_llp', /\bjda\b|\bllp\b/i],
  ['status', /^status$|\bstage\b/i],
  ['notes', /notes?|remarks?|comments?/i],
];
