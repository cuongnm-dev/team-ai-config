"""Writer briefing infrastructure for generate-docs skill.

Pipeline:
    intel/*.json + audience-profiles/*.yaml
              ↓
    canonical_facts.py — flexible dict from intel files
              ↓
    briefing_builder.py — applies profile (allow/deny + tropes + metrics)
              ↓
    docs/intel/_briefings/{audience}.md — the artifact writer consumes

Writer prompts NEVER @Files raw intel/*.json — only @Files {briefing.md}.
"""
