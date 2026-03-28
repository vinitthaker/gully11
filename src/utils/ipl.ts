export interface IPLTeam {
  code: string;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
}

export const IPL_TEAMS: IPLTeam[] = [
  { code: 'RCB', name: 'Royal Challengers Bengaluru', shortName: 'Bengaluru', color: '#EC1C24', textColor: '#FFFFFF' },
  { code: 'MI', name: 'Mumbai Indians', shortName: 'Mumbai', color: '#004BA0', textColor: '#FFFFFF' },
  { code: 'CSK', name: 'Chennai Super Kings', shortName: 'Chennai', color: '#FDB913', textColor: '#0B2240' },
  { code: 'KKR', name: 'Kolkata Knight Riders', shortName: 'Kolkata', color: '#3A225D', textColor: '#FFC42E' },
  { code: 'DC', name: 'Delhi Capitals', shortName: 'Delhi', color: '#0078BC', textColor: '#FFFFFF' },
  { code: 'PBKS', name: 'Punjab Kings', shortName: 'Punjab', color: '#ED1B24', textColor: '#FFFFFF' },
  { code: 'RR', name: 'Rajasthan Royals', shortName: 'Rajasthan', color: '#254AA5', textColor: '#FFFFFF' },
  { code: 'SRH', name: 'Sunrisers Hyderabad', shortName: 'Hyderabad', color: '#F26522', textColor: '#FFFFFF' },
  { code: 'GT', name: 'Gujarat Titans', shortName: 'Gujarat', color: '#1C1C2B', textColor: '#B0D1E8' },
  { code: 'LSG', name: 'Lucknow Super Giants', shortName: 'Lucknow', color: '#A72056', textColor: '#FFFFFF' },
];

export function getTeamByName(name: string): IPLTeam | undefined {
  return IPL_TEAMS.find(
    (t) =>
      t.name.toLowerCase() === name.toLowerCase() ||
      t.code.toLowerCase() === name.toLowerCase() ||
      t.shortName.toLowerCase() === name.toLowerCase()
  );
}

export function getTeamCode(fullName: string): string {
  const team = getTeamByName(fullName);
  return team?.code ?? fullName.slice(0, 3).toUpperCase();
}

// Payout table: returns payout amounts for each rank position (1st, 2nd, ...)
// Pool = memberCount * entryAmount
// Top half wins, bottom half loses, middle breaks even
export function calculatePayouts(memberCount: number, entryAmount: number): number[] {
  const pool = memberCount * entryAmount;

  if (memberCount <= 1) return [pool];
  if (memberCount === 2) return [pool, 0];
  if (memberCount === 3) return [entryAmount * 2, entryAmount, 0];

  // For 4+: top 3 split the pool, rest get 0
  // 1st: 50%, 2nd: 30%, 3rd: 20%
  const first = Math.round(pool * 0.5);
  const second = Math.round(pool * 0.3);
  const third = pool - first - second;

  const payouts = new Array(memberCount).fill(0);
  payouts[0] = first;
  payouts[1] = second;
  payouts[2] = third;

  return payouts;
}
