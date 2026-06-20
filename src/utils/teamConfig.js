// Full Information Services team member list
export const TEAM_EMAILS = new Set([
  'akash.manna@housing.com',
  'bheeshm.singh@housing.com',
  'gaurav.tyagi@housing.com',
  'gaurav.tyagi2@housing.com',
  'mudit.singh@housing.com',
  'jaiprakash.mishra@housing.com',
  'sanjeev.kumar3@housing.com',
  'atul1@housing.com',
  'harshit.gupta@housing.com',
  'bhupendra.singh@housing.com',
  'shikha.rani@housing.com',
  'shivam.saxena@housing.com',
  'harman.kohli@housing.com',
  'mohini.jaiswal@housing.com',
  'apurva@housing.com',
  'rohit.kaushal@housing.com',
  'ajay.tomar@housing.com',
  'saurabh.sippy@housing.com',
  'suneel.kumar@housing.com',
  'prakash.kanyal@housing.com',
]);

export function isTeamMember(email) {
  return email ? TEAM_EMAILS.has(email.trim().toLowerCase()) : false;
}
