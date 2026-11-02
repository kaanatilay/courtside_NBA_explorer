# Research only: make five small, read-only ESPN requests and save a compact
# evidence file. This script does not connect or modify the React application.
param(
    [string]$AsOf = '2026-10-31',
    [string]$TeamId = '13',
    [string]$AthleteId = '3945274'
)
$ErrorActionPreference = 'Stop'
$baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
$cutoff = [DateTimeOffset]::Parse("${AsOf}T23:59:59-03:00")
$season = if ($cutoff.Month -ge 7) { $cutoff.Year + 1 } else { $cutoff.Year }

# Convert a provider value only when it is present. Missing stats stay null,
# which is different from a real zero recorded on the court.
function Get-NumericStat($Value) {
    if ($null -eq $Value -or "$Value" -in @('', '--')) { return $null }
    $parsed = 0.0
    if ([double]::TryParse("$Value", [ref]$parsed)) { return $parsed }
    return $null
}

# Keep provider labels alongside player values; their order is not hard-coded.
function Get-PlayerSample($Payload, $PlayerId) {
    foreach ($team in $Payload.boxscore.players) {
        foreach ($group in $team.statistics) {
            foreach ($player in $group.athletes) {
                if ($player.athlete.id -ne $PlayerId) { continue }
                $stats = [ordered]@{}
                foreach ($label in @('MIN', 'PTS', 'AST', 'OREB', 'DREB', 'BLK')) {
                    $index = [array]::IndexOf(@($group.labels), $label)
                    $stats[$label] = if ($index -ge 0) { Get-NumericStat $player.stats[$index] } else { $null }
                }
                return [ordered]@{
                    id = $PlayerId; name = $player.athlete.displayName
                    didNotPlay = $player.didNotPlay; stats = $stats
                }
            }
        }
    }
    return $null
}

# Inspect team full-game totals separately from line scores. Only quarter
# points are confirmed here; do not imply the other totals are period splits.
function Get-GameSample($Payload) {
    $competition = $Payload.header.competitions[0]
    $teamSamples = foreach ($competitor in $competition.competitors) {
        $teamBox = $Payload.boxscore.teams | Where-Object { $_.team.id -eq $competitor.team.id } | Select-Object -First 1
        $stats = [ordered]@{}
        foreach ($key in @('assists', 'offensiveRebounds', 'defensiveRebounds', 'blocks')) {
            $value = $teamBox.statistics | Where-Object name -eq $key | Select-Object -First 1
            $stats[$key] = Get-NumericStat $value.displayValue
        }
        $periodPoints = @($competitor.linescores | ForEach-Object { Get-NumericStat $_.displayValue })
        $score = Get-NumericStat $competitor.score
        if (($periodPoints | Measure-Object -Sum).Sum -ne $score) { throw 'Period points do not reconcile to final score.' }
        [ordered]@{
            team = $competitor.team.abbreviation; fullGamePoints = $score
            periodPoints = $periodPoints; fullGameStats = $stats
            periodPointsReconcile = $true
        }
    }
    return [ordered]@{
        eventId = $Payload.header.id; dateUTC = $competition.date
        # ET is the conventional NBA schedule date; retain UTC to avoid ambiguity.
        dateEastern = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::Parse($competition.date), 'America/New_York').ToString('yyyy-MM-dd')
        completed = $competition.status.type.completed
        source = "$baseUrl/summary?event=$($Payload.header.id)"
        teams = @($teamSamples); player = Get-PlayerSample $Payload $AthleteId
    }
}

# A team schedule avoids the date-range scoreboard request, which returned
# HTTP 400 during investigation. ESPN identifies seasons by their ending year.
$scheduleUrl = "$baseUrl/teams/$TeamId/schedule?season=$season&seasontype=2"
$schedule = Invoke-RestMethod $scheduleUrl -TimeoutSec 20
$recent = @($schedule.events | Where-Object {
    $_.competitions[0].status.type.completed -eq $true -and [DateTimeOffset]::Parse($_.date) -le $cutoff
} | Sort-Object { [DateTimeOffset]::Parse($_.date) } -Descending | Select-Object -First 3)
if ($recent.Count -lt 3) { throw 'Fewer than three completed games were returned for this sample.' }
$samples = foreach ($event in $recent) {
    $payload = Invoke-RestMethod "$baseUrl/summary?event=$($event.id)" -TimeoutSec 20
    Get-GameSample $payload
}

# One known historical game checks that access is not limited to the new season.
$historical = Invoke-RestMethod "$baseUrl/summary?event=401704627" -TimeoutSec 20
$report = [ordered]@{
    checkedAtUTC = [DateTimeOffset]::UtcNow.ToString('o')
    asOf = $AsOf; provider = 'ESPN public site feed'; apiKeyUsed = $false
    scheduleSource = $scheduleUrl; scheduleEventsReturned = @($schedule.events).Count
    note = 'Last three completed TEAM games; a missing or DNP player is not a player appearance. Full historical coverage and quarter non-point stats remain unverified.'
    recent = @($samples); historical = Get-GameSample $historical
}
$outputPath = Join-Path $PSScriptRoot 'verified-samples.json'
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $outputPath -Encoding utf8
$report | ConvertTo-Json -Depth 12
