// Stable app IDs stay separate from ESPN IDs so another provider can be added.
export const teams = [
  { id: 'BOS', providerId: '2', city: 'Boston', name: 'Celtics', color: '#46cda0' },
  { id: 'LAL', providerId: '13', city: 'Los Angeles', name: 'Lakers', color: '#c9a6ff' },
  { id: 'GSW', providerId: '9', city: 'Golden State', name: 'Warriors', color: '#f0c768' },
  { id: 'NYK', providerId: '18', city: 'New York', name: 'Knicks', color: '#f29567' },
  // ESPN identities checked against the saved 30-team coverage audit. Keep
  // provider abbreviations separate from the canonical IDs used by the UI.
  { id: 'ATL', providerId: '1', city: 'Atlanta', name: 'Hawks', color: '#ed6875' },
  { id: 'BKN', providerId: '17', city: 'Brooklyn', name: 'Nets', color: '#c3ced6' },
  { id: 'CHA', providerId: '30', city: 'Charlotte', name: 'Hornets', color: '#57c6cc' },
  { id: 'CHI', providerId: '4', city: 'Chicago', name: 'Bulls', color: '#ef687d' },
  { id: 'CLE', providerId: '5', city: 'Cleveland', name: 'Cavaliers', color: '#d5b575' },
  { id: 'DAL', providerId: '6', city: 'Dallas', name: 'Mavericks', color: '#68ade8' },
  { id: 'DEN', providerId: '7', city: 'Denver', name: 'Nuggets', color: '#f3ce73' },
  { id: 'DET', providerId: '8', city: 'Detroit', name: 'Pistons', color: '#ec6b86' },
  { id: 'HOU', providerId: '10', city: 'Houston', name: 'Rockets', color: '#ee6a78' },
  { id: 'IND', providerId: '11', city: 'Indiana', name: 'Pacers', color: '#f4d178' },
  { id: 'LAC', providerId: '12', city: 'Los Angeles', name: 'Clippers', color: '#86a9ef' },
  { id: 'MEM', providerId: '29', city: 'Memphis', name: 'Grizzlies', color: '#99b2e3' },
  { id: 'MIA', providerId: '14', city: 'Miami', name: 'Heat', color: '#ee8394' },
  { id: 'MIL', providerId: '15', city: 'Milwaukee', name: 'Bucks', color: '#8ac69e' },
  { id: 'MIN', providerId: '16', city: 'Minnesota', name: 'Timberwolves', color: '#8bc4de' },
  { id: 'NOP', providerId: '3', city: 'New Orleans', name: 'Pelicans', color: '#d9bf86' },
  { id: 'OKC', providerId: '25', city: 'Oklahoma City', name: 'Thunder', color: '#70b8eb' },
  { id: 'ORL', providerId: '19', city: 'Orlando', name: 'Magic', color: '#85b5ed' },
  { id: 'PHI', providerId: '20', city: 'Philadelphia', name: '76ers', color: '#91aeef' },
  { id: 'PHX', providerId: '21', city: 'Phoenix', name: 'Suns', color: '#f0ac79' },
  { id: 'POR', providerId: '22', city: 'Portland', name: 'Trail Blazers', color: '#ec8991' },
  { id: 'SAC', providerId: '23', city: 'Sacramento', name: 'Kings', color: '#b8a0e4' },
  { id: 'SAS', providerId: '24', city: 'San Antonio', name: 'Spurs', color: '#b9cbd2' },
  { id: 'TOR', providerId: '28', city: 'Toronto', name: 'Raptors', color: '#e88394' },
  { id: 'UTA', providerId: '26', city: 'Utah', name: 'Jazz', color: '#b6a2ed' },
  { id: 'WAS', providerId: '27', city: 'Washington', name: 'Wizards', color: '#9ab7dd' },
];
export const metrics = [['pts', 'Points'], ['ast', 'Assists'], ['oreb', 'Off. rebounds'], ['dreb', 'Def. rebounds'], ['blk', 'Blocks']];

// ESPN names a season by its ending year. Use Halifax time, including DST.
export function currentSeason(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Halifax', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year').value);
  return year + (Number(parts.find(part => part.type === 'month').value) >= 7 ? 1 : 0);
}
