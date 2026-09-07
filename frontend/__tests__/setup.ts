jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'HEX', BASE64: 'BASE64' },
  digestStringAsync: jest.fn().mockImplementation(async (algo, str) => {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
  }),
  randomUUID: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock_documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ size: 102400 }),
}));

jest.mock('react-native-html-to-pdf', () => ({
  convert: jest.fn().mockResolvedValue({ filePath: 'file:///mock_documents/report.pdf' }),
}));

jest.mock('@react-native-picker/picker', () => ({
  Picker: 'Picker',
  PickerItem: 'PickerItem',
}), { virtual: true });

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
}));

// Mock for expo-sqlite in Jest environment with SQL execution semantics
class MockSQLiteDatabase {
  public tables: Record<string, any[]> = {
    schema_migrations: [],
    cases: [],
    evidence: [],
    events: [],
    actors: [],
    hash_chain: [],
    narratives: [],
  };

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      if (stmt.startsWith('PRAGMA') || stmt.startsWith('CREATE INDEX')) {
        continue;
      }
      if (stmt.startsWith('CREATE TABLE IF NOT EXISTS')) {
        const match = stmt.match(/CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/i);
        if (match && !this.tables[match[1]]) {
          this.tables[match[1]] = [];
        }
        continue;
      }
      if (stmt.startsWith('ALTER TABLE')) {
        continue;
      }
    }
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const trimmed = sql.trim();
    if (trimmed.startsWith('INSERT INTO')) {
      const match = trimmed.match(/INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES/i);
      if (!match) throw new Error(`Invalid INSERT SQL: ${sql}`);
      const table = match[1];
      const cols = match[2].split(',').map((c) => c.trim());
      if (!this.tables[table]) this.tables[table] = [];

      const row: Record<string, any> = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });

      // Constraint checks
      if (table === 'cases') {
        if (this.tables.cases.some((c) => c.case_number === row.case_number)) {
          throw new Error(`UNIQUE constraint failed: cases.case_number (${row.case_number})`);
        }
      } else if (table === 'evidence') {
        if (!this.tables.cases.some((c) => c.id === row.case_id)) {
          throw new Error(`FOREIGN KEY constraint failed: evidence.case_id (${row.case_id})`);
        }
      } else if (table === 'events') {
        if (!this.tables.cases.some((c) => c.id === row.case_id)) {
          throw new Error(`FOREIGN KEY constraint failed: events.case_id (${row.case_id})`);
        }
      } else if (table === 'actors') {
        if (!this.tables.cases.some((c) => c.id === row.case_id)) {
          throw new Error(`FOREIGN KEY constraint failed: actors.case_id (${row.case_id})`);
        }
      } else if (table === 'hash_chain') {
        if (!this.tables.evidence.some((e) => e.id === row.evidence_id)) {
          throw new Error(`FOREIGN KEY constraint failed: hash_chain.evidence_id (${row.evidence_id})`);
        }
      } else if (table === 'narratives') {
        if (!this.tables.cases.some((c) => c.id === row.case_id)) {
          throw new Error(`FOREIGN KEY constraint failed: narratives.case_id (${row.case_id})`);
        }
      }

      row.rowid = this.tables[table].length + 1;
      this.tables[table].push(row);
      return { changes: 1, lastInsertRowId: row.rowid };
    }

    if (trimmed.startsWith('UPDATE')) {
      const match = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+)\s+WHERE\s+(.+)/i);
      if (!match) throw new Error(`Invalid UPDATE SQL: ${sql}`);
      const table = match[1];
      const setClause = match[2];
      const whereClause = match[3];

      const setCols = setClause.split(',').map((part) => part.split('=')[0].trim());
      const setValues = params.slice(0, setCols.length);
      const whereValue = params[params.length - 1];

      const tableRows = this.tables[table] || [];
      let changes = 0;
      for (const row of tableRows) {
        if (whereClause.includes('id = ?') && row.id === whereValue) {
          setCols.forEach((col, idx) => {
            row[col] = setValues[idx];
          });
          changes++;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }

    if (trimmed.startsWith('DELETE FROM')) {
      const match = trimmed.match(/DELETE FROM\s+([a-zA-Z0-9_]+)\s+WHERE\s+(.+)/i);
      if (!match) throw new Error(`Invalid DELETE SQL: ${sql}`);
      const table = match[1];
      const whereClause = match[2];
      const whereValue = params[0];

      const tableRows = this.tables[table] || [];
      const beforeCount = tableRows.length;

      // Enforce cascade deletes
      if (table === 'cases' && whereClause.includes('id = ?')) {
        const caseId = whereValue;
        const evidenceToDelete = (this.tables.evidence || []).filter((e) => e.case_id === caseId);
        for (const ev of evidenceToDelete) {
          if (this.tables.hash_chain) {
            this.tables.hash_chain = this.tables.hash_chain.filter((hc) => hc.evidence_id !== ev.id);
          }
        }
        if (this.tables.evidence) {
          this.tables.evidence = this.tables.evidence.filter((e) => e.case_id !== caseId);
        }
        if (this.tables.events) {
          this.tables.events = this.tables.events.filter((ev) => ev.case_id !== caseId);
        }
        if (this.tables.actors) {
          this.tables.actors = this.tables.actors.filter((a) => a.case_id !== caseId);
        }
        if (this.tables.narratives) {
          this.tables.narratives = this.tables.narratives.filter((n) => n.case_id !== caseId);
        }
      } else if (table === 'evidence' && whereClause.includes('id = ?')) {
        const evidenceId = whereValue;
        if (this.tables.hash_chain) {
          this.tables.hash_chain = this.tables.hash_chain.filter((hc) => hc.evidence_id !== evidenceId);
        }
      }

      this.tables[table] = tableRows.filter((r) => r.id !== whereValue);
      return { changes: beforeCount - this.tables[table].length, lastInsertRowId: 0 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  async getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const trimmed = sql.trim();
    const match = trimmed.match(/SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?;?$/i);
    if (!match) return [];

    const table = match[2];
    const whereClause = match[3];
    const orderByClause = match[4];
    const limitClause = match[5];

    let rows = [...(this.tables[table] || [])];

    if (whereClause) {
      if (whereClause.includes('case_id = ?')) {
        const caseId = params[0];
        rows = rows.filter((r) => r.case_id === caseId);
      } else if (whereClause.includes('evidence_id = ?')) {
        const evidenceId = params[0];
        rows = rows.filter((r) => r.evidence_id === evidenceId);
      } else if (whereClause.includes('sha256_import = ?')) {
        const hash = params[0];
        rows = rows.filter((r) => r.sha256_import === hash);
      } else if (whereClause.includes('case_number = ?')) {
        const caseNumber = params[0];
        rows = rows.filter((r) => r.case_number === caseNumber);
      } else if (whereClause.includes('id = ?')) {
        const id = params[0];
        rows = rows.filter((r) => r.id === id);
      }
    }

    if (orderByClause) {
      const parts = orderByClause.split(',').map((p) => p.trim());
      for (const part of parts) {
        const [col, dir] = part.split(/\s+/);
        const isDesc = (dir || '').toUpperCase() === 'DESC';
        rows.sort((a, b) => {
          const valA = a[col] ?? 0;
          const valB = b[col] ?? 0;
          if (valA < valB) return isDesc ? 1 : -1;
          if (valA > valB) return isDesc ? -1 : 1;
          return 0;
        });
      }
    }

    if (limitClause) {
      const limit = parseInt(limitClause, 10);
      rows = rows.slice(0, limit);
    }

    return rows as T[];
  }

  async getFirstAsync<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async withExclusiveTransactionAsync(task: (txn?: any) => Promise<void>): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(this.tables));
    try {
      await task(this);
    } catch (err) {
      this.tables = snapshot;
      throw err;
    }
  }

  async withTransactionAsync(task: (txn?: any) => Promise<void>): Promise<void> {
    return this.withExclusiveTransactionAsync(task);
  }

  async closeAsync(): Promise<void> {}
}

const mockDatabases: Record<string, MockSQLiteDatabase> = {};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async (name: string) => {
    if (!mockDatabases[name]) {
      mockDatabases[name] = new MockSQLiteDatabase();
    }
    return mockDatabases[name];
  }),
  openDatabaseSync: jest.fn((name: string) => {
    if (!mockDatabases[name]) {
      mockDatabases[name] = new MockSQLiteDatabase();
    }
    return mockDatabases[name];
  }),
  __resetMockDatabase: (name?: string) => {
    if (name) {
      delete mockDatabases[name];
    } else {
      Object.keys(mockDatabases).forEach((k) => delete mockDatabases[k]);
    }
  },
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const colors = { primary: '#000', background: '#fff', surface: '#fff', text: '#000', onSurface: '#000', disabled: '#888', placeholder: '#888', backdrop: '#000', notification: '#f00', error: '#f00' };
  return {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Surface: ({ children, ...props }: any) => React.createElement('View', props, children),
    Card: ({ children, ...props }: any) => React.createElement('View', props, children),
    CardContent: ({ children, ...props }: any) => React.createElement('View', props, children),
    Button: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, React.createElement('Text', null, children)),
    IconButton: ({ ...props }: any) => React.createElement('TouchableOpacity', props),
    Switch: ({ ...props }: any) => React.createElement('Switch', props),
    TextInput: ({ ...props }: any) => React.createElement('TextInput', props),
    ProgressBar: ({ ...props }: any) => React.createElement('View', props),
    ActivityIndicator: ({ ...props }: any) => React.createElement('ActivityIndicator', props),
    Avatar: ({ ...props }: any) => React.createElement('View', props),
    Badge: ({ ...props }: any) => React.createElement('View', props),
    Chip: ({ ...props }: any) => React.createElement('View', props),
    Divider: ({ ...props }: any) => React.createElement('View', props),
    List: {
      Item: ({ children, ...props }: any) => React.createElement('View', props, children),
      Accordion: ({ children, ...props }: any) => React.createElement('View', props, children),
    },
    Menu: ({ ...props }: any) => React.createElement('View', props),
    Modal: ({ ...props }: any) => React.createElement('View', props),
    Snackbar: () => null,
    useTheme: () => ({ colors }),
    MD3DarkTheme: { colors },
    MD3LightTheme: { colors },
    adaptNavigationTheme: () => ({}),
    DefaultTheme: { colors },
    DarkTheme: { colors },
  };
});