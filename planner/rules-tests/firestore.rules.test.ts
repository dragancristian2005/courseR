import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setLogLevel } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

let env: RulesTestEnvironment;

beforeAll(async () => {
  setLogLevel('error'); // denied writes are expected; keep output readable
  env = await initializeTestEnvironment({
    projectId: 'demo-planner',
    firestore: { rules: readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const owner = () => env.authenticatedContext('alice').firestore();
const other = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

const seed = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(path).set(data);
  });

const TASK = 'users/alice/tasks/t1';
const SEMESTER = 'users/alice/meta/semester';

describe('owner', () => {
  it('can create and read a record', async () => {
    await assertSucceeds(owner().doc(TASK).set({ title: 'a', updatedAt: 1 }));
    await assertSucceeds(owner().doc(TASK).get());
  });

  it('can read a missing record', async () => {
    await assertSucceeds(owner().doc(TASK).get());
  });

  it('can create and update meta/semester', async () => {
    await assertSucceeds(owner().doc(SEMESTER).set({ start: '2026-09-01', updatedAt: 1 }));
    await assertSucceeds(owner().doc(SEMESTER).set({ start: '2026-09-02', updatedAt: 2 }));
    await assertSucceeds(owner().doc(SEMESTER).get());
  });

  it('can write other collections under their uid', async () => {
    await assertSucceeds(owner().doc('users/alice/courses/c1').set({ updatedAt: 5 }));
  });
});

describe('another uid', () => {
  beforeEach(async () => {
    await seed(TASK, { title: 'a', updatedAt: 1 });
    await seed(SEMESTER, { updatedAt: 1 });
  });

  it('cannot read', async () => {
    await assertFails(other().doc(TASK).get());
    await assertFails(other().doc(SEMESTER).get());
  });

  it('cannot create', async () => {
    await assertFails(other().doc('users/alice/tasks/t2').set({ updatedAt: 1 }));
  });

  it('cannot update', async () => {
    await assertFails(other().doc(TASK).set({ title: 'x', updatedAt: 99 }));
    await assertFails(other().doc(SEMESTER).set({ updatedAt: 99 }));
  });

  it('cannot delete', async () => {
    await assertFails(other().doc(TASK).delete());
  });
});

describe('unauthenticated', () => {
  beforeEach(async () => {
    await seed(TASK, { title: 'a', updatedAt: 1 });
    await seed(SEMESTER, { updatedAt: 1 });
  });

  it('cannot read', async () => {
    await assertFails(anon().doc(TASK).get());
    await assertFails(anon().doc(SEMESTER).get());
  });

  it('cannot create', async () => {
    await assertFails(anon().doc('users/alice/tasks/t2').set({ updatedAt: 1 }));
  });

  it('cannot update', async () => {
    await assertFails(anon().doc(TASK).set({ updatedAt: 99 }));
  });

  it('cannot delete', async () => {
    await assertFails(anon().doc(TASK).delete());
  });
});

describe('delete', () => {
  it('is denied even for the owner', async () => {
    await seed(TASK, { title: 'a', updatedAt: 1 });
    await seed(SEMESTER, { updatedAt: 1 });
    await assertFails(owner().doc(TASK).delete());
    await assertFails(owner().doc(SEMESTER).delete());
  });
});

describe('updatedAt must be a number', () => {
  it('is required on create', async () => {
    await assertFails(owner().doc(TASK).set({ title: 'a' }));
  });

  it('rejects a string on create', async () => {
    await assertFails(owner().doc(TASK).set({ title: 'a', updatedAt: '1' }));
  });

  it('rejects null on create', async () => {
    await assertFails(owner().doc(TASK).set({ title: 'a', updatedAt: null }));
  });

  it('rejects a non-number on update', async () => {
    await seed(TASK, { title: 'a', updatedAt: 1 });
    await assertFails(owner().doc(TASK).set({ title: 'a', updatedAt: '2' }));
    await assertFails(owner().doc(TASK).update({ updatedAt: '2' }));
  });

  it('rejects removing updatedAt on update', async () => {
    await seed(TASK, { title: 'a', updatedAt: 1 });
    await assertFails(owner().doc(TASK).set({ title: 'b' }));
  });

  it('applies to meta/semester too', async () => {
    await assertFails(owner().doc(SEMESTER).set({ start: 'x' }));
    await assertFails(owner().doc(SEMESTER).set({ updatedAt: 'now' }));
  });
});

describe('update needs a strictly greater updatedAt', () => {
  beforeEach(async () => {
    await seed(TASK, { title: 'a', updatedAt: 10 });
    await seed(SEMESTER, { updatedAt: 10 });
  });

  it('accepts a greater value', async () => {
    await assertSucceeds(owner().doc(TASK).set({ title: 'b', updatedAt: 11 }));
    await assertSucceeds(owner().doc(TASK).update({ updatedAt: 12 }));
  });

  it('rejects an equal value', async () => {
    await assertFails(owner().doc(TASK).set({ title: 'b', updatedAt: 10 }));
  });

  it('rejects a smaller value', async () => {
    await assertFails(owner().doc(TASK).set({ title: 'b', updatedAt: 9 }));
    await assertFails(owner().doc(TASK).update({ updatedAt: 1 }));
  });

  it('applies to meta/semester too', async () => {
    await assertFails(owner().doc(SEMESTER).set({ updatedAt: 10 }));
    await assertFails(owner().doc(SEMESTER).set({ updatedAt: 3 }));
    await assertSucceeds(owner().doc(SEMESTER).set({ updatedAt: 11 }));
  });
});

describe('paths outside users/{uid}', () => {
  it('are denied for everyone', async () => {
    await assertFails(owner().doc('other/x').set({ updatedAt: 1 }));
    await assertFails(owner().doc('other/x').get());
  });
});
