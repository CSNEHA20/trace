# TRACE Database Architecture

The TRACE database engine runs locally on-device using `expo-sqlite` and `expo-secure-store`.

- **Schema:** Defined in [schema.sql](file:///f:/SNEHA/IQOO%2726-Trace/database/schema.sql)
- **Encryption:** AES-256 local database encryption backed by hardware Secure Enclave / Keystore keys.
