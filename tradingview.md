To use custom data in a TradingView advanced chart, you must use a client-side JavaScript implementation with the TradingView Charting Library. This requires a custom data feed that fetches and formats the data for the chart widget. You cannot simply paste raw data directly into the standard advanced chart.
Custom data organization and typing
For the JavaScript implementation, your custom data feed will need to have a getBars function that returns historical bar data in a specific structure. The data should be organized into an array of objects, where each object represents a single bar (or candle) and contains specific fields.
The required fields for each bar object are:
time: The timestamp for the bar, in Unix time (milliseconds since epoch).
open: The opening price for the bar.
high: The highest price reached during the bar's period.
low: The lowest price reached during the bar's period.
close: The closing price for the bar.
volume: (Optional) The trading volume during the bar's period.
