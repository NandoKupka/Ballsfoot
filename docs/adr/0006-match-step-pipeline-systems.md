# Match step pipeline systems

Ballsfoot keeps `MatchEngine` as the public facade for browser, tests, and analytics, but delegates each fixed simulation step to an ordered pipeline of domain systems. This preserves the no-build plain-module workflow while giving tactical movement, ball lifecycle, restarts, defensive actions, attacking decisions, pressure, statistics, and clock progression independent boundaries that can absorb more formations and match events.
