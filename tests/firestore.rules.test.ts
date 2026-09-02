import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

const PROJECT_ID = 'madrasah-rules-test';
const COLLECTIONS = [
  'notes',
  'drafts',
  'projects',
  'books',
  'concepts',
  'sourceFragments',
  'relations',
  'learningPaths',
  'phases',
  'competencies',
  'decks',
  'flashcards'
] as const;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [host, portStr] = firestoreHost.split(':');
  const port = parseInt(portStr, 10) || 8080;

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host,
      port
    }
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe('Firestore Security Rules - 12 Collections Verification', () => {
  const ALICE_UID = 'alice_123';
  const BOB_UID = 'bob_456';

  COLLECTIONS.forEach((colName) => {
    describe(`Collection: /${colName}`, () => {
      it(`[${colName}] get() tanpa autentikasi -> harus DITOLAK (assertFails)`, async () => {
        // Seed a document bypass rules
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, colName, 'doc_seed_1'), {
            userId: ALICE_UID,
            title: 'Sample Data'
          });
        });

        const unauthDb = testEnv.unauthenticatedContext().firestore();
        const docRef = doc(unauthDb, colName, 'doc_seed_1');
        await assertFails(getDoc(docRef));
      });

      it(`[${colName}] list() tanpa autentikasi -> harus DITOLAK (assertFails)`, async () => {
        const unauthDb = testEnv.unauthenticatedContext().firestore();
        const colRef = collection(unauthDb, colName);
        await assertFails(getDocs(colRef));
      });

      it(`[${colName}] list() tanpa where('userId', '==', uid) -> pengujian riil query menyeluruh`, async () => {
        // Seed documents for Alice and Bob
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, colName, 'alice_doc_1'), { userId: ALICE_UID, title: 'Alice Data' });
          await setDoc(doc(db, colName, 'bob_doc_1'), { userId: BOB_UID, title: 'Bob Data' });
        });

        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
        const blanketColRef = collection(aliceDb, colName);

        // Firestore rules evaluation: if a query does not constrain by userId == uid,
        // Firestore rejects the blanket query upfront because it could match documents where userId != auth.uid.
        await assertFails(getDocs(blanketColRef));
      });

      it(`[${colName}] list() DENGAN query where('userId', '==', uid) -> harus DIIZINKAN (assertSucceeds)`, async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, colName, 'alice_doc_1'), { userId: ALICE_UID, title: 'Alice Data' });
        });

        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
        const userQuery = query(collection(aliceDb, colName), where('userId', '==', ALICE_UID));
        await assertSucceeds(getDocs(userQuery));
      });

      it(`[${colName}] create dengan userId berbeda dari auth.uid (Spoofing) -> harus DITOLAK (assertFails)`, async () => {
        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
        const docRef = doc(aliceDb, colName, 'doc_alice_spoof');
        // Alice attempts to set userId = BOB_UID
        await assertFails(setDoc(docRef, {
          userId: BOB_UID,
          title: 'Spoofed Data'
        }));
      });

      it(`[${colName}] create dokumen valid milik sendiri (auth.uid == userId) -> harus DIIZINKAN (assertSucceeds)`, async () => {
        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
        const docRef = doc(aliceDb, colName, 'doc_alice_valid_123');
        await assertSucceeds(setDoc(docRef, {
          userId: ALICE_UID,
          title: 'Alice Valid Note'
        }));
      });

      it(`[${colName}] update dokumen milik user lain -> harus DITOLAK (assertFails)`, async () => {
        // Seed Bob's document
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, colName, 'bob_doc_target'), {
            userId: BOB_UID,
            title: 'Bob Secret'
          });
        });

        // Alice tries to update Bob's document
        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
        const docRef = doc(aliceDb, colName, 'bob_doc_target');
        await assertFails(updateDoc(docRef, {
          title: 'Hacked by Alice'
        }));
      });

      it(`[${colName}] delete dokumen milik user lain -> harus DITOLAK (assertFails)`, async () => {
        // Seed Bob's document
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, colName, 'bob_doc_delete_target'), {
            userId: BOB_UID,
            title: 'Bob Important Record'
          });
        });

        // Alice tries to delete Bob's document
        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
        const docRef = doc(aliceDb, colName, 'bob_doc_delete_target');
        await assertFails(deleteDoc(docRef));
      });

      it(`[${colName}] update & delete dokumen milik sendiri -> harus DIIZINKAN (assertSucceeds)`, async () => {
        // Seed Alice's document
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await setDoc(doc(db, colName, 'alice_doc_self'), {
            userId: ALICE_UID,
            title: 'Alice Original'
          });
        });

        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
        const docRef = doc(aliceDb, colName, 'alice_doc_self');

        await assertSucceeds(updateDoc(docRef, {
          title: 'Alice Updated'
        }));

        await assertSucceeds(deleteDoc(docRef));
      });

      it(`[${colName}] ID dokumen dengan karakter terlarang / format invalid -> harus DITOLAK (assertFails)`, async () => {
        const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();

        // Invalid characters like spaces, slashes, or special symbols violating ^[a-zA-Z0-9_\-]+$
        const invalidDocId = 'invalid doc id with spaces!';
        const docRef = doc(aliceDb, colName, invalidDocId);

        await assertFails(setDoc(docRef, {
          userId: ALICE_UID,
          title: 'Invalid ID Test'
        }));
      });
    });
  });

  describe('Catch-All & Undeclared Collections Protection', () => {
    it('Akses baca/tulis ke koleksi yang tidak terdaftar (/unregistered_collection) -> harus DITOLAK (assertFails)', async () => {
      const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
      const unregDoc = doc(aliceDb, 'unregistered_collection', 'doc_secret_999');

      await assertFails(setDoc(unregDoc, {
        userId: ALICE_UID,
        secret: 'Should be denied'
      }));

      await assertFails(getDoc(unregDoc));
    });

    it('Akses ke subkoleksi acak /notes/{noteId}/secret_sub -> harus DITOLAK (assertFails)', async () => {
      const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
      const subDoc = doc(aliceDb, 'notes', 'valid_note_1', 'secret_sub', 'sub_doc_1');

      await assertFails(setDoc(subDoc, {
        userId: ALICE_UID,
        val: 123
      }));

      await assertFails(getDoc(subDoc));
    });
  });
});
