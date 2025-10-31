    /**
     * @notice Get current TWAP (Time-Weighted Average Price) for a market
     * @dev This is the manipulation-resistant price all protocol contracts should use
     * @dev TWAP calculation: weights newer observations less to prevent manipulation
     * @param marketId Market identifier to get price for
     * @return Time-weighted average price in basis points (0-10000)
     */
    function getPrice(bytes32 marketId) external view returns (uint96) {
        Observation[] storage observations = priceObservations[marketId];

        // Ensure we have at least one observation
        if (observations.length == 0) revert InsufficientObservations();

        uint64 currentTime = uint64(block.timestamp);
        uint64 twapStart = currentTime - twapPeriod; // Calculate TWAP window start

        uint256 weightedSum = 0; // Sum of (price * weight)
        uint256 totalWeight = 0; // Sum of weights

        // Calculate time-weighted average across all observations in TWAP window
        for (uint256 i = 0; i < observations.length; i++) {
            Observation memory obs = observations[i];

            // Only include observations within the TWAP time window
            if (obs.timestamp >= twapStart) {
                // Weight is time distance from current (older = higher weight = harder to manipulate)
                // Add 1 to prevent zero weight for current timestamp
                uint256 weight = currentTime - obs.timestamp + 1;

                weightedSum += obs.price * weight; // Accumulate weighted price
                totalWeight += weight; // Accumulate total weight
            }
        }

        // Ensure we found at least one observation in the TWAP window
        if (totalWeight == 0) revert InsufficientObservations();

        // Return weighted average: (sum of weighted prices) / (sum of weights)
        return uint96(weightedSum / totalWeight);
    }
