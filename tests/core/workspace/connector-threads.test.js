import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';

import Workspace from '../../../src/core/workspace/Workspace.js';
import { WorkspaceConnectorIndex } from '../../../src/core/workspace/services/connectors/index.js';
import {
    WORKSPACE_LAYOUTS,
    workspaceInternals,
    workspaceServices,
} from '../../../src/core/workspace/lib/constants.js';

/**
 * Chat threads: one document per message, the thread as an edge. Driven
 * through the real Slack driver against a stubbed `fetch`, so the whole path
 * is exercised — reply fetching, `parentProvenanceUrl`, checksum resolution
 * of the parent at ingest, the asserted `replies-to` edge, and the two
 * membership rules that make a thread the unit of work:
 *
 *   - filing the ROOT into a context pulls its replies along (and unfiling
 *     takes them out) — Workspace link/unlink cascade;
 *   - a reply arriving AFTER the root was filed lands where the root is —
 *     ingest-side inheritance.
 */

const TEAM = 'T1';
const CHANNEL = 'C1';
const ROOT_TS = '100.000100';
const LONE_TS = '102.000100';
const REPLY_TS = '101.000100';
const LATE_REPLY_TS = '103.000100';

const provenance = (ts) => `slack://${TEAM}/${CHANNEL}/${ts}`;
const checksum = (ts) => WorkspaceConnectorIndex.identityChecksum(provenance(ts));

describe('connector threads (slack)', () => {
    let root;
    let ws;
    let replies;   // what conversations.replies returns for ROOT_TS
    let latestReply;
    const originalFetch = globalThis.fetch;

    const stubSlack = (method, params) => {
        switch (method) {
            case 'auth.test': return { ok: true, team_id: TEAM };
            case 'conversations.list': return { ok: true, channels: [{ id: CHANNEL, name: 'general', is_member: true }] };
            case 'conversations.history': return {
                ok: true,
                has_more: false,
                messages: [
                    { type: 'message', ts: LONE_TS, user: 'U2', text: 'unthreaded' },
                    { type: 'message', ts: ROOT_TS, user: 'U1', text: 'root', reply_count: replies.length, latest_reply: latestReply },
                ],
            };
            case 'conversations.replies': {
                assert.equal(params.get('ts'), ROOT_TS);
                return {
                    ok: true,
                    messages: [
                        { type: 'message', ts: ROOT_TS, thread_ts: ROOT_TS, user: 'U1', text: 'root' },
                        ...replies,
                    ],
                };
            }
            default: throw new Error(`unexpected slack call ${method}`);
        }
    };

    const contextPaths = async (id) => {
        const placements = await ws.listDocumentPlacements(id);
        // Memberships list every layer along a path; compare the leaves.
        return Workspace.leafPaths(placements.filter((p) => p.type === 'context').flatMap((p) => p.paths)).filter((p) => p !== '/');
    };

    const waitFor = async (probe, what, { timeout = 10_000 } = {}) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const value = await probe().catch(() => null);
            if (value) return value;
            await new Promise((r) => setTimeout(r, 50));
        }
        throw new Error(`${what} never happened`);
    };
    const waitForDoc = (ts) => waitFor(() => ws.getByChecksumString(checksum(ts), { parse: false }), `document for ${ts}`);
    // Ingest-side inheritance runs right AFTER the put lands, so a placement
    // check has to wait for the placement, not merely for the document.
    const waitForContext = (id, ctxPath) => waitFor(async () => (await contextPaths(id)).includes(ctxPath), `${id} in ${ctxPath}`);

    before(async () => {
        globalThis.fetch = async (url, init) => {
            const method = String(url).split('/api/')[1];
            const params = new URLSearchParams(init?.body || '');
            const json = stubSlack(method, params);
            return { ok: true, status: 200, json: async () => json };
        };

        root = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-threads-'));
        const store = {
            id: 'ws-threads-1',
            name: 'ws',
            owner: 'user-1',
            layout: WORKSPACE_LAYOUTS.FULL,
            internals: { ...workspaceInternals(WORKSPACE_LAYOUTS.FULL) },
            services: workspaceServices(WORKSPACE_LAYOUTS.FULL),
        };
        ws = new Workspace({
            rootPath: root,
            configStore: {
                store,
                get: (key, fallback) => (store[key] !== undefined ? store[key] : fallback),
                set: (key, value) => { store[key] = value; },
                delete: (key) => { delete store[key]; },
            },
            logger: { info() {}, warn() {}, debug() {}, error() {} },
        });
        await ws.start();

        replies = [{ type: 'message', ts: REPLY_TS, thread_ts: ROOT_TS, user: 'U2', text: 'reply' }];
        latestReply = REPLY_TS;
        await ws.addBackend('slack', { address: 'acme', token: 'xoxb-test', channels: ['general'] });
    });

    after(async () => {
        globalThis.fetch = originalFetch;
        await ws?.stop().catch(() => {});
        if (root) { await fs.remove(root); }
    });

    test('a reply asserts replies-to its root; the root and lone messages assert nothing', async () => {
        const rootDoc = await waitForDoc(ROOT_TS);
        const replyDoc = await waitForDoc(REPLY_TS);
        const lone = await waitForDoc(LONE_TS);

        assert.deepEqual(replyDoc.data.relations, [{ p: 'replies-to', to: rootDoc.id }]);
        assert.equal(replyDoc.data.parentMessageId, ROOT_TS);
        assert.equal(replyDoc.data.channel.type, 'thread');
        assert.equal(rootDoc.data.relations, undefined);
        assert.equal(lone.data.relations, undefined);

        const rel = ws.listDocumentRelations(rootDoc.id);
        assert.deepEqual(rel.incoming.map((e) => [e.p, e.from, e.meta.src]), [['replies-to', replyDoc.id, 'doc']]);
    });

    test('filing the root into a context pulls the reply along; unfiling takes it out', async () => {
        const rootDoc = await waitForDoc(ROOT_TS);
        const replyDoc = await waitForDoc(REPLY_TS);
        const lone = await waitForDoc(LONE_TS);

        await ws.link(rootDoc.id, { context: '/ops/jira-1' });
        assert.deepEqual(await contextPaths(rootDoc.id), ['/ops/jira-1']);
        assert.deepEqual(await contextPaths(replyDoc.id), ['/ops/jira-1']);
        assert.deepEqual(await contextPaths(lone.id), []);

        // unlink removes the leaf layer only (the engine keeps '/ops' ticked),
        // so the check is "no longer under the ticket", for root and reply alike.
        await ws.unlink(rootDoc.id, { context: '/ops/jira-1' });
        assert.equal((await contextPaths(rootDoc.id)).includes('/ops/jira-1'), false);
        assert.equal((await contextPaths(replyDoc.id)).includes('/ops/jira-1'), false);
    });

    test('a reply that arrives after the root was filed lands where the root is', async () => {
        const rootDoc = await waitForDoc(ROOT_TS);
        await ws.link(rootDoc.id, { context: '/ops/jira-2' });

        replies = [
            ...replies,
            { type: 'message', ts: LATE_REPLY_TS, thread_ts: ROOT_TS, user: 'U3', text: 'late reply' },
        ];
        latestReply = LATE_REPLY_TS;
        await ws.syncBackend('slack', 'acme');

        const late = await waitForDoc(LATE_REPLY_TS);
        assert.deepEqual(late.data.relations, [{ p: 'replies-to', to: rootDoc.id }]);
        await waitForContext(late.id, '/ops/jira-2');
        assert.equal((await contextPaths(late.id)).includes('/ops/jira-1'), false);
        // The earlier reply followed the root at link time and stays put.
        const early = await waitForDoc(REPLY_TS);
        assert.equal((await contextPaths(early.id)).includes('/ops/jira-2'), true);
    });
});
