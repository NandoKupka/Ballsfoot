# Plain modules organized by responsibility

Ballsfoot separates editable team configuration, the headless domain engine, batch analytics, and the browser adapter into plain JavaScript modules. The modules expose browser globals and CommonJS exports so the app remains directly openable through `file://` while the same engine and analytics can run under Node without a build step.
