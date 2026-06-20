// Full Information Services team member list.
// Matched by full name (as it appears in the ticket activity log) since the
// activity-log data source no longer carries assignee email addresses.
export const TEAM_NAMES = new Set([
  'Akash Manna',
  'Bheeshm Singh',
  'Gaurav Tyagi',
  'Mudit Singh',
  'Jai Prakash Mishra',
  'Harshit Gupta',
  'Bhupendra Singh',
  'Shivam Singh', // formerly tracked as "Shivam Saxena"
  'Harman Kaur Kohli',
  'Rohit Kaushal',
  'Saurabh Sippy',
  'Suneel Kumar',
  'Prakash Singh Kanyal',
]);

export function isTeamMember(name) {
  return name ? TEAM_NAMES.has(name.trim()) : false;
}
