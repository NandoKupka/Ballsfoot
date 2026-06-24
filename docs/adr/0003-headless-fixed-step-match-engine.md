# Headless fixed-step match engine

Ballsfoot runs match rules, continuous time, movement, seeded decisions, and the ball lifecycle inside a headless `MatchEngine`, while a browser adapter owns DOM and playback. A fixed internal step makes results independent of browser frame chunks, and modelling the ball as controlled, travelling, loose, or out prevents possession from changing before a pass or shot physically resolves.
