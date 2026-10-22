import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { recordEventWithDb } from "./eventHistory";

describe("recordEventWithDb replay semantics", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    // Maye gurbin da schema/migration na gaske idan ya bambanta
    db.exec(`
      CREATE TABLE stream_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        ledger_sequence INTEGER,
        timestamp INTEGER NOT NULL,
        actor TEXT, amount REAL, metadata TEXT
      );
      CREATE UNIQUE INDEX idx_dedup
        ON stream_events(stream_id, event_type, ledger_sequence);
    `);
  });

  const count = () =>
    (db.prepare("SELECT COUNT(*) AS n FROM stream_events").get() as { n: number }).n;

  it("returns 'inserted' for a new event", () => {
    expect(recordEventWithDb(db, "1", "created", 100, "A", 5, undefined, 10)).toBe("inserted");
    expect(count()).toBe(1);
  });

  it("returns 'deduped' for an identical replayed event and keeps one row", () => {
    recordEventWithDb(db, "1", "created", 100, "A", 5, undefined, 10);
    expect(recordEventWithDb(db, "1", "created", 100, "A", 5, undefined, 10)).toBe("deduped");
    expect(count()).toBe(1);
  });

  it("treats the same event type at a different ledger as new", () => {
    recordEventWithDb(db, "1", "claimed", 100, "A", 1, undefined, 10);
    expect(recordEventWithDb(db, "1", "claimed", 101, "A", 1, undefined, 11)).toBe("inserted");
    expect(count()).toBe(2);
  });
});
