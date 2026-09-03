/**
 * Date helpers extracted so challengeService can import without circular gameEngine deps.
 */
function getChallengeStartMs(startDateStr) {
    if (!startDateStr) return Date.now();
    const parts = startDateStr.split('-');
    if (parts.length === 3) {
        const isoStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T00:00:00.000+05:30`;
        return new Date(isoStr).getTime();
    }
    return new Date(startDateStr).getTime();
}

function getDayNumber(timestampMs, startDateStr) {
    const startMs = getChallengeStartMs(startDateStr);
    const diffMs = timestampMs - startMs;
    if (diffMs < 0) return 1;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function getChallengeEndMs(endDateStr) {
    if (!endDateStr) return Date.now();
    const parts = String(endDateStr).split('-');
    if (parts.length === 3) {
        return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T23:59:59.999+05:30`).getTime();
    }
    return new Date(endDateStr).getTime();
}

module.exports = { getChallengeStartMs, getDayNumber, getChallengeEndMs };
