import { mkdir, writeFile } from 'node:fs/promises';

// Download a bounded set for offline regression checks. Keep only the game,
// box-score, and event fields needed by the parser; omit articles and media.
const base = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`ESPN HTTP ${response.status}`);
  return response.json();
}
const scoreboard = await get(`${base}/scoreboard?dates=20241112`);
const overtime = scoreboard.events.find(event => event.competitions[0].competitors.some(team => team.team.abbreviation === 'DET')
  && event.competitions[0].competitors.some(team => team.team.abbreviation === 'MIA'));
if (!overtime) throw new Error('The selected overtime game was not found.');
const ids = ['401704627', '401909285', '401909880', overtime.id];
const directory = new URL('../server/fixtures/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const id of ids) {
  const payload = await get(`${base}/summary?event=${id}`);
  const fixture = {
    source: `${base}/summary?event=${id}`, capturedAt: new Date().toISOString(),
    header: { id: payload.header.id, competitions: payload.header.competitions.map(game => ({
      date: game.date, status: game.status, competitors: game.competitors.map(team => ({ team: { id: team.team.id, abbreviation: team.team.abbreviation },
        score: team.score, homeAway: team.homeAway, linescores: team.linescores })),
    })) },
    boxscore: { teams: payload.boxscore.teams.map(team => ({ team: { id: team.team.id }, statistics: team.statistics })),
      players: payload.boxscore.players.map(team => ({ team: { id: team.team.id }, statistics: team.statistics.map(group => ({ labels: group.labels,
        athletes: group.athletes.map(player => ({ athlete: { id: player.athlete.id, displayName: player.athlete.displayName },
          didNotPlay: player.didNotPlay, stats: player.stats })),
      })) })) },
    plays: payload.plays.map(play => Object.fromEntries(['id', 'sequenceNumber', 'type', 'text', 'period', 'clock', 'scoringPlay', 'scoreValue', 'team',
      'participants', 'homeScore', 'awayScore', 'shootingPlay'].filter(key => key in play).map(key => [key, play[key]]))),
  };
  await writeFile(new URL(`espn-${id}.json`, directory), JSON.stringify(fixture));
  console.log(JSON.stringify({ id, teams: fixture.header.competitions[0].competitors.map(team => team.team.abbreviation),
    plays: fixture.plays.length, periods: Math.max(...fixture.plays.map(play => play.period.number)),
    reviews: fixture.plays.filter(play => /review|overturn|challenge/i.test(play.text)).length }));
}
