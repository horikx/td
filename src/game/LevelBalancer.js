export default class LevelBalancer {
    static calculateDifficulty(levelData, enemyConfig, towerConfig, pathLengthPixels) {
        if (!levelData || !enemyConfig || !towerConfig) return { score: 0, rating: 'Unknown', details: {} };

        // 1. Identify Best Tower (DPS per Cost)
        let bestTower = null;
        let bestEfficiency = 0;

        for (const key in towerConfig) {
            const tower = towerConfig[key];
            const dps = tower.damage * (1000 / tower.fireRate);
            const efficiency = dps / tower.cost;
            if (efficiency > bestEfficiency) {
                bestEfficiency = efficiency;
                bestTower = tower;
            }
        }

        if (!bestTower) return { score: 0, rating: 'No Towers', details: {} };

        // 2. Simulate Waves
        let currentGold = levelData.startingMoney;
        let minWaveScore = Infinity;
        let totalScore = 0;
        const waveDetails = [];

        levelData.waves.forEach((wave, index) => {
            let waveHealth = 0;
            let waveBounty = 0;
            let maxExposure = 0; // Max time an enemy is on screen

            wave.enemies.forEach(group => {
                const enemyType = enemyConfig[group.type];
                if (enemyType) {
                    const count = group.count || 0;
                    waveHealth += enemyType.health * count;
                    waveBounty += enemyType.bounty * count;

                    // Exposure time in seconds
                    // Speed is pixels per second (approx, depending on game loop)
                    // Assuming speed in config is pixels/sec for now. 
                    // If speed is high (e.g. 100), exposure is low.
                    const exposure = pathLengthPixels / enemyType.speed;
                    if (exposure > maxExposure) maxExposure = exposure;
                }
            });

            // Calculate Potential Damage
            // How many best towers can we build?
            const maxTowers = Math.floor(currentGold / bestTower.cost);
            const dps = bestTower.damage * (1000 / bestTower.fireRate);

            // Total damage output if all towers fire constantly at the enemy for the full duration
            // This is a theoretical maximum (upper bound)
            const potentialDamage = maxTowers * dps * maxExposure;

            // Score: Ratio of Potential Damage to Health
            // > 1.0 means theoretically beatable
            // < 1.0 means mathematically impossible (unless splash/slow/micro changes things)
            let waveScore = waveHealth > 0 ? potentialDamage / waveHealth : 999;

            // Cap score for display sanity
            if (waveScore > 10) waveScore = 10;

            if (waveScore < minWaveScore) minWaveScore = waveScore;
            totalScore += waveScore;

            waveDetails.push({
                wave: wave.name || `Wave ${index + 1}`,
                health: waveHealth,
                potentialDmg: Math.round(potentialDamage),
                score: waveScore.toFixed(2),
                gold: currentGold
            });

            // Add bounty for next wave
            currentGold += waveBounty;
        });

        // Overall Rating
        // We use the minimum wave score because the chain is as strong as its weakest link.
        // If one wave is impossible, the level is impossible.
        const finalScore = minWaveScore === Infinity ? 0 : minWaveScore;

        let rating = 'Impossible';
        if (finalScore >= 2.5) rating = 'Easy';
        else if (finalScore >= 1.5) rating = 'Medium';
        else if (finalScore >= 1.0) rating = 'Hard';

        return {
            score: finalScore,
            rating: rating,
            details: waveDetails,
            bestTower: bestTower.name
        };
    }
}
