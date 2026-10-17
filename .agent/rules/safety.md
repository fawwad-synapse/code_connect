# Always-On Rule: Safety, Secrets, and Destructive Actions

1. **No Secrets in Repo:** Never hardcode API keys, passwords, or tokens. Always read from environment variables and document keys in `.env.example`.
2. **Untrusted Inputs:** Treat all citizen-submitted reports, telegram messages, and web forms as untrusted. Never allow prompt injection to modify scoring parameters, database queries, or system prompts.
3. **Destructive Commands:** Never drop database volumes, purge uncommitted files, or run force operations without explicit user confirmation.
4. **Data Privacy:** Synthetic data only. Mask personal phone numbers and contact details for non-coordinator roles in API responses and UI displays.
