# TRACE Integrity Ledger

The TRACE integrity ledger is a tamper-evident, SHA-256 linked hash chain stored locally in the SQLite `hash_chain` table. It is inspired by Merkle-tree chaining principles and provides a reliable audit trail for all evidence operations. It is **not** a distributed blockchain.

---

## How It Works

Every operation performed on an evidence item appends a new **ledger node** to the chain. Each node is cryptographically linked to the previous one, making silent tampering detectable.

### Hash Types

| Hash | Formula | Purpose |
|------|---------|---------|
| **Import Hash** | `SHA-256(original_file_bytes_base64)` | Canonical identity of the original file |
| **Processing Hash** | `SHA-256(deterministic_feature_string)` | Hash of extracted data (OCR, transcription, etc.) |
| **Chain Hash** | `SHA-256(prev_chain_hash + payload_hash)` | Links this node to all previous nodes |

### Genesis Node
The first node for any evidence item uses the genesis hash as its "previous":
```
prev_chain_hash = 0000000000000000000000000000000000000000000000000000000000000000  (64 zeros)
```

---

## Ledger Node Structure

```typescript
interface LedgerNode {
  id: string;            // UUID
  evidence_id: string;   // FK to evidence
  operation: ChainOperation; // IMPORT | EXTRACT | CLUSTER | EXPORT
  position: number;      // Sequential (0, 1, 2, ...) — monotonically increasing
  payload_hash: string;  // SHA-256 of the operation's payload
  chain_hash: string;    // SHA-256(prev_chain_hash + payload_hash)
  timestamp: number;     // Unix ms
}
```

---

## Operations

| Operation | Triggered By |
|-----------|-------------|
| `IMPORT` | Evidence is imported from the device |
| `EXTRACT` | Text, metadata, or transcription is extracted |
| `CLUSTER` | Evidence is clustered or grouped |
| `EXPORT` | A forensic report is generated |

---

## Tamper Detection

The `VerificationService` re-derives all chain hashes from scratch and detects:

| Condition | Detection Method |
|-----------|----------------|
| **Modified file** | Import hash recomputed from file bytes vs. stored import hash |
| **Modified payload** | Recomputed chain hash mismatches stored value (the payload hash feeds into the chain) |
| **Deleted ledger entry** | Position gap detected (expected sequential position ≠ actual) |
| **Reordered entry** | Timestamp regression detected between consecutive nodes |
| **Altered chain hash** | `SHA-256(prev_chain_hash + payload_hash)` ≠ stored `chain_hash` |
| **Altered payload hash** | Cascades: changes to payload hash break the chain hash at that node |
| **Missing genesis** | First node's chain hash does not match a genesis-seeded computation |

---

## Services

### `HashService`
Provides all hashing primitives. Uses `expo-crypto` (real SHA-256) on-device, with a Node.js `crypto` fallback for test environments.

### `ChainService`
Manages ledger append operations. Enforces append-only behavior — no update or delete methods are exposed.

### `VerificationService`
Performs full chain verification. Re-derives every chain hash independently and collects all tamper detection reasons.

---

## Security Properties

- **No cloud calls:** All hashing and verification is performed entirely on-device.
- **Append-only:** The `ChainService` provides no mutation or deletion methods.
- **Deterministic:** Payload strings are JSON-serialized with sorted keys, ensuring consistent hash output.
- **Sequential positions:** Each node's position is stored and verified against its index.

---

## UI: IntegrityPanel

The `IntegrityPanel` React Native component provides a visual integrity dashboard for each evidence item. It shows:
- Verification status (VERIFIED / TAMPERED)
- List of detected tampering reasons
- Node-by-node chain view (collapsible)
- One-click chain re-verification

---

## Storage

Ledger nodes are persisted in the local SQLite `hash_chain` table via `DatabaseEngine.insertHashChain()`. The table is subject to the same foreign key constraints as the rest of the TRACE schema.
