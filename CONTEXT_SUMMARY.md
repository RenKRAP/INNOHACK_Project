# Project Context

## Verified facts
- This folder is a Git worktree for https://github.com/RenKRAP/INNOHACK_Project.git.
- The working branch is RenK_RAP/깃허브-업로드, based on e1db57d.
- Local_server contains the Express server, optional Supabase PostgreSQL integration, SQL schema, and setup documentation.
- The server package provides start/dev scripts and no automated test script.
- Root ignore rules exclude node_modules and environment files while allowing .env.example.

## Changes and decisions
- Renamed server to Local_server as requested; source file contents are unchanged.
- Upload this worktree to remote main without incorporating the separate main worktree's unpublished commit.

## Verification
- node --check Local_server/index.js passed.
- git diff --cached --check passed; all seven server files are detected as 100% identical renames.
- No database or deployed service checks were run because this change only renames a directory.

## Historical notes and remaining work
- Remote main was e1db57d when inspected before the change.
- A separate worktree has local main at c4cb91a and is outside this task.
- Delivery target: remote main. Confirm the pushed commit ID against the remote after delivery.
- Any external deployment root-directory setting that uses server will need Local_server; external configuration is unknown.
